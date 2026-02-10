import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartCount, toggleCart } from '@stores/cart';

export default function CartIcon() {
  const [hydrated, setHydrated] = useState(false);
  const count = useStore(cartCount);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <button
      onClick={toggleCart}
      className="relative flex items-center justify-center w-11 h-11 rounded-xl text-gray-400 bg-white/5 border border-white/10 transition-all duration-300 hover:text-[#d4af37] hover:bg-[rgba(212,175,55,0.1)] hover:border-[rgba(212,175,55,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.15)]"
      aria-label="Abrir carrito"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
      {hydrated && count > 0 && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-accent-gold to-accent-gold-soft text-dark-bg text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-glow-gold">
          {count}
        </span>
      )}
    </button>
  );
}
