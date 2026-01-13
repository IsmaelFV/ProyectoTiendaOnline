import { useState } from 'react';
import { addToCart } from '@stores/cart';
import Toast from '@components/ui/Toast';

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

  const handleAddToCart = () => {
    if (!selectedSize) {
      setShowError(true);
      return;
    }

    setIsAdding(true);
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      size: selectedSize,
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
        <div>
          <label className="block text-sm font-medium text-brand-charcoal mb-2">
            Selecciona tu talla
          </label>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-4 py-2 border-2 transition-all ${
                  selectedSize === size
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-brand-slate/30 hover:border-brand-navy'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          {showError && !selectedSize && (
            <p className="text-red-600 text-sm mt-2 font-medium">
              ⚠ Debes seleccionar una talla para continuar
            </p>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`w-full btn-primary ${isAdding ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isAdding ? 'Añadiendo...' : 'Añadir al Carrito'}
        </button>
      </div>
    </>
  );
}
