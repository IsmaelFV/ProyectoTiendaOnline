/**
 * ============================================================================
 * CLOUDINARY - Gestión de Imágenes
 * ============================================================================
 * Funciones para subir y optimizar imágenes usando Cloudinary CDN
 */

// Configuración desde variables de entorno
const CLOUDINARY_CLOUD_NAME = import.meta.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.NEXT_PUBLIC_CLOUDINARY_PRESET;

/**
 * Subir una imagen a Cloudinary
 * @param file - Archivo de imagen seleccionado por el usuario
 * @returns URL segura de la imagen o null si hay error
 */
export const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
  try {
    // 1. Crear el formulario de datos (FormData)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('folder', 'productos'); // Organizar en carpeta productos

    // 2. Construir la URL de subida
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    // 3. Hacer la petición POST
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error en Cloudinary:', error);
      throw new Error('Error en la subida a Cloudinary');
    }

    const data = await response.json();

    // 4. Retornar la URL segura
    return data.secure_url;
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    return null;
  }
};

/**
 * Subir múltiples imágenes a Cloudinary
 * @param files - Array de archivos
 * @returns Array de URLs o array vacío si hay error
 */
export const uploadMultipleImages = async (files: File[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadImageToCloudinary(file));
    const results = await Promise.all(uploadPromises);
    
    // Filtrar los null (errores) y devolver solo URLs válidas
    return results.filter((url): url is string => url !== null);
  } catch (error) {
    console.error('Error subiendo múltiples imágenes:', error);
    return [];
  }
};

/**
 * Optimizar URL de Cloudinary con transformaciones automáticas
 * @param url - URL original de Cloudinary
 * @param options - Opciones de optimización
 * @returns URL optimizada
 */
export interface OptimizationOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'scale' | 'crop';
  gravity?: 'auto' | 'face' | 'center';
}

export const getOptimizedImageUrl = (
  url: string,
  options: OptimizationOptions = {}
): string => {
  // Si no es una URL de Cloudinary, devolver original
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
    gravity = 'auto',
  } = options;

  // Construir parámetros de transformación
  const transformations: string[] = [];

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);
  if (gravity && crop === 'fill') transformations.push(`g_${gravity}`);
  
  // Optimizaciones automáticas
  transformations.push(`f_${format}`); // Formato automático (WebP, AVIF)
  transformations.push(`q_${quality}`); // Calidad automática

  const transformString = transformations.join(',');

  // Insertar transformaciones en la URL
  // Estructura: .../upload/[TRANSFORMACIONES]/v1234/imagen.jpg
  return url.replace('/upload/', `/upload/${transformString}/`);
};

/**
 * Presets comunes de optimización
 */
export const ImagePresets = {
  // Para tarjetas de productos (catálogo)
  productCard: (url: string) =>
    getOptimizedImageUrl(url, {
      width: 400,
      height: 500,
      crop: 'fill',
      gravity: 'auto',
    }),

  // Para galería de producto (página detalle)
  productGallery: (url: string) =>
    getOptimizedImageUrl(url, {
      width: 800,
      height: 1000,
      crop: 'fit',
    }),

  // Para thumbnails pequeños
  thumbnail: (url: string) =>
    getOptimizedImageUrl(url, {
      width: 150,
      height: 150,
      crop: 'fill',
      gravity: 'center',
    }),

  // Para hero/banners
  hero: (url: string) =>
    getOptimizedImageUrl(url, {
      width: 1920,
      height: 800,
      crop: 'fill',
      gravity: 'auto',
    }),

  // Para carrito (imágenes pequeñas)
  cart: (url: string) =>
    getOptimizedImageUrl(url, {
      width: 80,
      height: 80,
      crop: 'fill',
    }),
};

/**
 * Validar si un archivo es una imagen válida
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de archivo no válido. Usa JPG, PNG, WebP o GIF.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'El archivo es demasiado grande. Máximo 10MB.',
    };
  }

  return { valid: true };
};
