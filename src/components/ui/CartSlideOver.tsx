import { useStore } from '@nanostores/react';
import { isCartOpen, cartItems, cartTotal, closeCart, updateQuantity, removeFromCart, clearCart } from '@stores/cart';
import { formatPrice } from '@lib/utils';
import { ImagePresets } from '@lib/cloudinary';
import { useState, useEffect } from 'react';
import DiscountCodeInput from '@components/islands/DiscountCodeInput';

export default function CartSlideOver() {
  const open = useStore(isCartOpen);
  const items = useStore(cartItems);
  const total = useStore(cartTotal);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [finalTotal, setFinalTotal] = useState(total);

  const itemsArray = Object.entries(items).map(([key, item]) => ({ key, ...item }));

  // Sincronizar finalTotal con el total del carrito cuando cambia
  useEffect(() => {
    if (!appliedDiscount) {
      setFinalTotal(total);
    }
  }, [total, appliedDiscount]);

  const handleDiscountApplied = (discountData: any) => {
    setAppliedDiscount(discountData);
    if (discountData && discountData.final_total !== undefined) {
      setFinalTotal(discountData.final_total);
    } else {
      setFinalTotal(total);
    }
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setError('');

    try {
      // Preparar items para el checkout (solo ID y cantidad)
      const checkoutItems = itemsArray.map(item => ({
        id: item.id,
        quantity: item.quantity
      }));

      // Llamar al endpoint de checkout
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: checkoutItems,
          discountCode: appliedDiscount?.code || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      // Limpiar carrito antes de redirigir
      clearCart();

      // Redirigir a Stripe Checkout
      window.location.href = data.url;

    } catch (err: any) {
      console.error('Error en checkout:', err);
      setError(err.message || 'Error al procesar el pago. Inténtalo de nuevo.');
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={closeCart}
      />
      
      <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-serif text-2xl font-bold text-brand-navy">Tu Carrito</h2>
          <button
            onClick={closeCart}
            className="p-2 hover:text-brand-gold transition-colors"
            aria-label="Cerrar carrito"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {itemsArray.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                className="w-16 h-16 mx-auto text-brand-slate/30 mb-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              <p className="text-brand-slate text-lg">Tu carrito está vacío</p>
              <button
                onClick={closeCart}
                className="mt-4 btn-secondary"
              >
                Continuar Comprando
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {itemsArray.map(({ key, id, name, price, quantity, size, image, slug, category, gender }) => (
                  <div key={key} className="flex gap-4 border-b pb-4">
                    {image && (
                      <a href={`/productos/${slug}`} className="flex-shrink-0">
                        <img
                          src={ImagePresets.cart(image)}
                          alt={name}
                          className="w-20 h-20 object-cover"
                        />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/productos/${slug}`}
                        className="font-medium text-brand-charcoal hover:text-brand-navy"
                      >
                        {name}
                      </a>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-brand-slate">
                        {gender && <span>📍 {gender.name}</span>}
                        {category && <span>• {category.name}</span>}
                        {size && <span>• Talla: {size}</span>}
                      </div>
                      <p className="text-sm font-semibold text-brand-navy mt-1">
                        {formatPrice(price)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(key, quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center border border-brand-slate/30 hover:border-brand-navy transition-colors"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(key, quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center border border-brand-slate/30 hover:border-brand-navy transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(key)}
                          className="ml-auto text-sm text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t px-6 py-4 space-y-4">
              <DiscountCodeInput 
                cartTotal={total} 
                onDiscountApplied={handleDiscountApplied}
              />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>{formatPrice(total)}</span>
                </div>
                
                {appliedDiscount && appliedDiscount.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                    <span>Descuento:</span>
                    <span>-{formatPrice(appliedDiscount.discount_amount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span className="font-serif text-2xl text-brand-navy">{formatPrice(finalTotal)}</span>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </span>
                ) : (
                  'Proceder al Pago'
                )}
              </button>
              
              <button
                onClick={closeCart}
                className="w-full btn-secondary"
              >
                Continuar Comprando
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Pago seguro con Stripe</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
