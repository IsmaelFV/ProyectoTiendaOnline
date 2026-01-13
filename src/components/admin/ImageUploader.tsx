/**
 * ============================================================================
 * Componente: ImageUploader
 * ============================================================================
 * Upload de imágenes a Cloudinary con preview y validación
 */

import { useState } from 'react';
import { uploadMultipleImages, validateImageFile } from '@lib/cloudinary';

interface ImageUploaderProps {
  onImagesUploaded: (urls: string[]) => void;
  maxImages?: number;
  existingImages?: string[];
}

export default function ImageUploader({ 
  onImagesUploaded, 
  maxImages = 5,
  existingImages = []
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>(existingImages);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (!files.length) return;

    // Validar límite de imágenes
    if (previews.length + files.length > maxImages) {
      setError(`Máximo ${maxImages} imágenes permitidas`);
      return;
    }

    // Validar cada archivo
    for (const file of files) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Error en validación');
        return;
      }
    }

    setError('');
    setUploading(true);
    setProgress(0);

    try {
      // Crear previews locales mientras se suben
      const localPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...localPreviews]);

      // Subir a Cloudinary
      const uploadedUrls = await uploadMultipleImages(files);

      if (uploadedUrls.length !== files.length) {
        throw new Error('Algunas imágenes no se pudieron subir');
      }

      // Reemplazar previews locales con URLs de Cloudinary
      setPreviews(prev => {
        const newPreviews = [...prev];
        // Remover las previews locales temporales
        localPreviews.forEach(preview => URL.revokeObjectURL(preview));
        // Actualizar con URLs reales
        return [...existingImages, ...uploadedUrls];
      });

      setProgress(100);
      onImagesUploaded([...existingImages, ...uploadedUrls]);
    } catch (err) {
      console.error('Error al subir imágenes:', err);
      setError('Error al subir las imágenes. Inténtalo de nuevo.');
      // Restaurar previews anteriores
      setPreviews(existingImages);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newPreviews = previews.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    onImagesUploaded(newPreviews);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Imágenes del Producto ({previews.length}/{maxImages})
        </label>
        {previews.length < maxImages && (
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-navy hover:bg-brand-charcoal disabled:opacity-50">
              {uploading ? 'Subiendo...' : '+ Añadir Imágenes'}
            </span>
          </label>
        )}
      </div>

      {/* Barra de progreso */}
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-brand-gold h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Grid de previews */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {previews.map((preview, index) => (
          <div key={index} className="relative group">
            <img
              src={preview}
              alt={`Preview ${index + 1}`}
              className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              disabled={uploading}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              aria-label="Eliminar imagen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 bg-brand-gold text-white text-xs px-2 py-1 rounded">
                Principal
              </span>
            )}
          </div>
        ))}
      </div>

      {previews.length === 0 && !uploading && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No hay imágenes. Haz clic en "Añadir Imágenes"</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        * La primera imagen será la imagen principal del producto
      </p>
    </div>
  );
}
