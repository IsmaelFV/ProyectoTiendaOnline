import { useState } from 'react';
import { addToCart } from '@stores/cart';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    image?: string;
    sizes: string[];
  };
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert('Por favor, selecciona una talla');
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
    });

    setTimeout(() => {
      setIsAdding(false);
    }, 500);
  };

  return (
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
      </div>

      <button
        onClick={handleAddToCart}
        disabled={isAdding}
        className={`w-full btn-primary ${isAdding ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        {isAdding ? 'Añadiendo...' : 'Añadir al Carrito'}
      </button>
    </div>
  );
}
