# Configuración de Google OAuth en Supabase

## ✅ Cambios Realizados

Se ha reemplazado la autenticación con **Twitter y GitHub** por **Google OAuth** en:

- ✅ Página de inicio de sesión ([/auth/login](http://localhost:4321/auth/login))
- ✅ Página de registro ([/auth/register](http://localhost:4321/auth/register))
- ✅ Página de callback OAuth ([/auth/callback](http://localhost:4321/auth/callback))

## 🔧 Configuración Requerida en Supabase

Para que Google OAuth funcione, necesitas configurarlo en tu proyecto de Supabase:

### 1. Obtener Credenciales de Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **"APIs & Services" > "Credentials"**
4. Click en **"Create Credentials" > "OAuth 2.0 Client ID"**
5. Configura la pantalla de consentimiento si es necesario
6. Selecciona **"Web application"** como tipo
7. Agrega las URIs autorizadas:
   ```
   Authorized JavaScript origins:
   - http://localhost:4321
   - https://tu-dominio.com
   
   Authorized redirect URIs:
   - https://[TU-PROYECTO].supabase.co/auth/v1/callback
   - http://localhost:4321/auth/callback
   ```
8. Copia el **Client ID** y **Client Secret**

### 2. Configurar en Supabase Dashboard

1. Ve a tu [Supabase Dashboard](https://app.supabase.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication > Providers**
4. Busca **Google** y haz click en configurar
5. Activa el toggle **"Enable Google provider"**
6. Pega tu **Client ID** y **Client Secret**
7. Guarda los cambios

### 3. Configurar URL de Redirección

En Supabase Dashboard:
1. Ve a **Authentication > URL Configuration**
2. Agrega estas URLs de redirección:
   ```
   - http://localhost:4321/auth/callback
   - https://tu-dominio.com/auth/callback
   ```

## 📝 Funcionamiento

### Login/Register Flow:

1. Usuario hace click en **"Continuar con Google"**
2. Se abre popup de Google OAuth
3. Usuario autoriza la aplicación
4. Google redirige a `/auth/callback` con tokens
5. La página callback:
   - Guarda tokens en cookies
   - Guarda tokens en localStorage para Supabase
   - Redirige al usuario al home

### Código Implementado:

**Login/Register Button:**
```typescript
googleBtn?.addEventListener('click', async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    }
  });
  
  if (error) {
    customAlert('Error al iniciar sesión con Google: ' + error.message, 'error');
  }
});
```

**Callback Handler:**
- Procesa tokens del hash de la URL
- Guarda en localStorage y cookies
- Redirige al home si hay sesión válida

## 🎨 Diseño

El botón de Google usa el tema oscuro consistente:
- Logo oficial de Google (multicolor)
- Fondo: `bg-gray-900` con borde sutil
- Texto: `text-white`
- Hover: Efecto de elevación
- Centrado y responsive

## 🧪 Testing

Para probar localmente:

1. Asegúrate de tener configurado Google OAuth en Supabase
2. Inicia el servidor: `npm run dev`
3. Ve a http://localhost:4321/auth/login
4. Click en "Continuar con Google"
5. Autoriza la aplicación
6. Deberías ser redirigido al home con sesión activa

## ⚠️ Importante

- **Producción**: Actualiza las redirect URIs con tu dominio real
- **HTTPS**: En producción, usa HTTPS obligatoriamente
- **Cookies**: Las cookies `sb-access-token` y `sb-refresh-token` tienen 7 días de validez
- **Seguridad**: Los tokens nunca se exponen en logs del cliente

## 📚 Archivos Modificados

1. `src/pages/auth/login.astro` - Botón Google OAuth
2. `src/pages/auth/register.astro` - Botón Google OAuth
3. `src/scripts/login-client.ts` - Handler de Google login
4. `src/pages/auth/callback.astro` - Handler de callback OAuth (NUEVO)

## 🔗 Referencias

- [Supabase Google OAuth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
