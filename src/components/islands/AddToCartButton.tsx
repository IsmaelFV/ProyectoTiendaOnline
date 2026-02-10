import { useState } from 'react';
import { addToCart } from '@stores/cart';
import Toast from '@components/ui/Toast';
import SizeRecommender from './SizeRecommender';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    image?: string;
    sizes: string[];
    category?: {
      name: string;
      slug: string;
    };
    gender?: {
      name: string;
      slug: string;
    };
  };
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Si no hay tallas, seleccionar "Única" por defecto
  const hasSizes = product.sizes && product.sizes.length > 0;
  const availableSizes = hasSizes ? product.sizes : ['Única'];

  const handleAddToCart = () => {
    const sizeToUse = hasSizes ? selectedSize : 'Única';
    
    if (hasSizes && !selectedSize) {
      setShowError(true);
      return;
    }

    setIsAdding(true);
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      size: sizeToUse,
      image: product.image,
      slug: product.slug,
      category: product.category,
      gender: product.gender,
    });

    setTimeout(() => {
      setIsAdding(false);
      setShowSuccess(true);
    }, 500);
  };

  return (
    <>
      {showError && (
        <Toast 
          message="Por favor, selecciona una talla antes de añadir al carrito"
          type="warning"
          onClose={() => setShowError(false)}
        />
      )}
      
      {showSuccess && (
        <Toast 
          message="Producto añadido al carrito correctamente"
          type="success"
          onClose={() => setShowSuccess(false)}
        />
      )}

      <div className="space-y-4">
        {hasSizes && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Selecciona tu talla
              </label>
              <SizeRecommender 
                productSizes={product.sizes} 
                onSelectSize={(size) => setSelectedSize(size)} 
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 border-2 rounded-lg transition-all ${
                    selectedSize === size
                      ? 'border-accent-gold bg-accent-gold/20 text-white'
                      : 'border-white/20 hover:border-accent-gold/50 text-gray-300 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            {showError && !selectedSize && (
              <p className="text-red-400 text-sm mt-2 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                Debes seleccionar una talla para continuar
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`w-full btn btn-primary ${isAdding ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isAdding ? 'Añadiendo...' : 'Añadir al Carrito'}
        </button>
      </div>
    </>
  );
}
