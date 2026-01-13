/**
 * ============================================================================
 * Componente: OptimizedImage
 * ============================================================================
 * Wrapper para <img> que optimiza automáticamente imágenes de Cloudinary
 */

import { ImagePresets, getOptimizedImageUrl, type OptimizationOptions } from '@lib/cloudinary';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  preset?: keyof typeof ImagePresets;
  optimization?: OptimizationOptions;
}

export default function OptimizedImage({ 
  src, 
  alt, 
  preset, 
  optimization,
  className = '',
  ...props 
}: OptimizedImageProps) {
  // Determinar URL optimizada
  let optimizedSrc = src;
  
  if (preset && ImagePresets[preset]) {
    // Usar preset predefinido
    optimizedSrc = ImagePresets[preset](src);
  } else if (optimization) {
    // Usar optimización personalizada
    optimizedSrc = getOptimizedImageUrl(src, optimization);
  } else if (src.includes('cloudinary.com')) {
    // Si es Cloudinary sin especificar, aplicar optimización básica
    optimizedSrc = getOptimizedImageUrl(src, {
      quality: 'auto',
      format: 'auto',
    });
  }

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      {...props}
    />
  );
}
