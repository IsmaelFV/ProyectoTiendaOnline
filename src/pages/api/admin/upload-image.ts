import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = 'product-images';

/**
 * Asegura que el bucket de imágenes existe, lo crea si no
 */
async function ensureBucketExists(client: ReturnType<typeof createServerSupabaseClient>) {
  const { data: buckets } = await client.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    console.info(`[Upload] Bucket "${BUCKET_NAME}" no existe, creándolo...`);
    const { error } = await client.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error) {
      console.error('[Upload] Error creando bucket:', error);
      throw new Error(`No se pudo crear el bucket: ${error.message}`);
    }
    console.info(`[Upload] Bucket "${BUCKET_NAME}" creado correctamente`);
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    console.info(`[Upload] accessToken: ${accessToken ? 'present (' + accessToken.substring(0, 20) + '...)' : 'MISSING'}`);
    console.info(`[Upload] refreshToken: ${refreshToken ? 'present' : 'MISSING'}`);
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado - sin token de acceso. Cierra sesión y vuelve a entrar.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intentar obtener usuario, si falla con access token, intentar refresh
    let user = null;
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    
    if (userError || !userData?.user) {
      console.warn('[Upload] Token expirado o inválido, intentando refresh...');
      if (refreshToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (refreshError || !refreshData?.user) {
          console.error('[Upload] Refresh falló:', refreshError?.message);
          return new Response(JSON.stringify({ error: 'Sesión expirada. Cierra sesión y vuelve a entrar.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        user = refreshData.user;
        // Actualizar cookies con nuevos tokens
        if (refreshData.session) {
          cookies.set('sb-access-token', refreshData.session.access_token, { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
          cookies.set('sb-refresh-token', refreshData.session.refresh_token, { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Usuario no válido' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      user = userData.user;
    }
    
    console.info(`[Upload] Usuario verificado: ${user.id}`);

    // 2. Verificar que es admin
    const adminSupabase = createServerSupabaseClient();
    const { data: adminUser } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id);

    if (!adminUser || adminUser.length === 0) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Obtener archivo del formulario
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se proporcionó ningún archivo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Validar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ 
        error: `Tipo de archivo no permitido: ${file.type}. Usa JPG, PNG, WebP, GIF, AVIF o SVG.` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Validar tamaño
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ 
        error: `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Asegurar que el bucket existe
    await ensureBucketExists(adminSupabase);

    // 7. Generar nombre único
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const filePath = `productos/${timestamp}-${randomId}-${safeName}.${ext}`;

    // 8. Subir a Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    console.info(`[Upload] Subiendo ${file.name} (${(file.size / 1024).toFixed(0)}KB, ${file.type}) → ${filePath}`);

    const { data, error } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[Upload] Error de Supabase Storage:', error.message, error);
      return new Response(JSON.stringify({ 
        error: `Error al subir la imagen: ${error.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 9. Obtener URL pública
    const { data: publicUrlData } = adminSupabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    const publicUrl = publicUrlData.publicUrl;

    console.info(`[Upload] ✅ Imagen subida correctamente: ${publicUrl}`);

    return new Response(JSON.stringify({ 
      success: true, 
      url: publicUrl,
      path: data.path,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Upload] Error interno:', error?.message || error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
