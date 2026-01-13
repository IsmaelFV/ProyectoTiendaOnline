import { useStore } from '@nanostores/react';
import { isCartOpen, cartItems, cartTotal, closeCart, updateQuantity, removeFromCart } from '@stores/cart';
import { formatPrice } from '@lib/utils';

export default function CartSlideOver() {
  const open = useStore(isCartOpen);
  const items = useStore(cartItems);
  const total = useStore(cartTotal);

  const itemsArray = Object.entries(items).map(([key, item]) => ({ key, ...item }));

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
                {itemsArray.map(({ key, id, name, price, quantity, size, image, slug }) => (
                  <div key={key} className="flex gap-4 border-b pb-4">
                    {image && (
                      <a href={`/productos/${slug}`} className="flex-shrink-0">
                        <img
                          src={image}
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
                      <p className="text-sm text-brand-slate mt-1">Talla: {size}</p>
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
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span className="font-serif text-2xl text-brand-navy">{formatPrice(total)}</span>
              </div>
              
              <button className="w-full btn-primary">
                Proceder al Pago
              </button>
              
              <button
                onClick={closeCart}
                className="w-full btn-secondary"
              >
                Continuar Comprando
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
