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
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const itemsArray = Object.entries(items).map(([key, item]) => ({ key, ...item }));

  // Sincronizar finalTotal con el total del carrito cuando cambia
  useEffect(() => {
    if (!appliedDiscount) {
      setFinalTotal(total);
    }
  }, [total, appliedDiscount]);

  // Resetear estado de procesamiento cuando el usuario vuelve atrás del checkout de Stripe
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      // persisted = true cuando la página se restaura del bfcache (botón atrás)
      if (e.persisted) {
        console.log('[CART] Página restaurada del bfcache - reseteando estado');
        setIsProcessing(false);
        setError('');
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isProcessing) {
        // Si la página vuelve a ser visible y estábamos procesando, resetear
        console.log('[CART] Página visible de nuevo - reseteando procesamiento');
        setIsProcessing(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isProcessing]);

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
      // Preparar items para el checkout (ID, cantidad Y talla)
      const checkoutItems = itemsArray.map(item => ({
        id: item.id,
        quantity: item.quantity,
        size: item.size || 'Única'
      }));

      console.log('[CHECKOUT CLIENT] Enviando items al checkout:', JSON.stringify(checkoutItems, null, 2));

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
        console.error('[CHECKOUT CLIENT] Error del servidor:', JSON.stringify(data));
        // El error ya viene descriptivo del servidor
        throw new Error(data.error || 'Error al procesar el pago');
      }

      // Redirigir a Stripe Checkout (el carrito se limpia en success.astro tras confirmar el pago)
      window.location.href = data.url;

    } catch (err: any) {
      console.error('Error en checkout:', err);
      const msg = err.message || 'Error al procesar el pago. Inténtalo de nuevo.';
      // Si es un error de stock, mostrar mensaje más claro
      if (msg.includes('Stock insuficiente') || msg.includes('stock')) {
        setError(msg);
      } else {
        setError(msg);
      }
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
        onClick={closeCart}
      />
      
      <div className="fixed inset-y-0 right-0 max-w-md w-full bg-dark-surface/95 backdrop-blur-xl border-l border-white/10 shadow-glass-lg z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h2 className="font-serif text-2xl font-bold text-white">Tu Carrito</h2>
          <button
            onClick={closeCart}
            className="p-2 text-gray-400 hover:text-accent-gold transition-colors duration-300"
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
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-dark-card/50 border border-white/5 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  className="w-10 h-10 text-gray-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-400 text-lg mb-2">Tu carrito está vacío</p>
              <p className="text-gray-600 text-sm mb-6">Explora nuestra colección</p>
              <button
                onClick={closeCart}
                className="btn-secondary"
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
                  <div key={key} className="flex gap-4 border-b border-white/5 pb-4">
                    {image && (
                      <a href={`/productos/${slug}`} className="flex-shrink-0">
                        <img
                          src={ImagePresets.cart(image)}
                          alt={name}
                          className="w-20 h-20 object-cover rounded-xl"
                        />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/productos/${slug}`}
                        className="font-medium text-white hover:text-accent-gold transition-colors"
                      >
                        {name}
                      </a>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                        {gender && <span>{gender.name}</span>}
                        {category && <span>• {category.name}</span>}
                        {size && <span>• Talla: {size}</span>}
                      </div>
                      <p className="text-sm font-semibold text-accent-gold mt-1">
                        {formatPrice(price)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(key, quantity - 1)}
                          disabled={updatingKey === key}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:border-accent-gold/50 hover:text-accent-gold transition-colors disabled:opacity-50"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-white">{quantity}</span>
                        <button
                          onClick={async () => {
                            setUpdatingKey(key);
                            setError('');
                            const result = await updateQuantity(key, quantity + 1);
                            if (result && !result.success) {
                              setError(result.error || 'No hay más stock disponible');
                            }
                            setUpdatingKey(null);
                          }}
                          disabled={updatingKey === key}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:border-accent-gold/50 hover:text-accent-gold transition-colors disabled:opacity-50"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(key)}
                          className="ml-auto text-sm text-red-400 hover:text-red-300 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 px-6 py-5 space-y-4 bg-dark-card/50">
              <DiscountCodeInput 
                cartTotal={total} 
                onDiscountApplied={handleDiscountApplied}
              />
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm text-gray-400">
                  <span>Subtotal:</span>
                  <span className="text-gray-200">{formatPrice(total)}</span>
                </div>
                
                {appliedDiscount && appliedDiscount.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-400 font-medium">
                    <span>Descuento:</span>
                    <span>-{formatPrice(appliedDiscount.discount_amount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-lg font-semibold pt-3 border-t border-white/10">
                  <span className="text-white">Total:</span>
                  <span className="font-serif text-2xl text-accent-gold">{formatPrice(finalTotal)}</span>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm whitespace-pre-wrap">
                  {error}
                </div>
              )}
              
              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
                    </svg>
                    <span>Proceder al Pago</span>
                  </>
                )}
              </button>
              
              <button
                onClick={closeCart}
                className="btn btn-secondary w-full"
              >
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Continuar Comprando
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500/80 pt-1">
                <svg className="w-3.5 h-3.5 text-emerald-500/70" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Pago 100% seguro con Stripe</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
