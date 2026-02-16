import { useState, useEffect } from 'react';

interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  sale_price?: number | null;
  is_on_sale?: boolean;
  timestamp: number;
}

interface Props {
  currentProductId?: string;
  maxItems?: number;
}

const STORAGE_KEY = 'recently-viewed';
const MAX_STORED = 12;

export function addToRecentlyViewed(product: Omit<RecentProduct, 'timestamp'>) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as RecentProduct[];
    const filtered = stored.filter(p => p.id !== product.id);
    const updated = [{ ...product, timestamp: Date.now() }, ...filtered].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInCents / 100);
}

export default function RecentlyViewed({ currentProductId, maxItems = 6 }: Props) {
  const [products, setProducts] = useState<RecentProduct[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as RecentProduct[];
      const filtered = stored
        .filter(p => p.id !== currentProductId)
        .slice(0, maxItems);
      setProducts(filtered);
    } catch { /* ignore */ }
  }, [currentProductId]);

  if (products.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 border-t border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">Vistos recientemente</h2>
          <p className="text-sm text-gray-500 mt-1">Productos que has visitado</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent -mx-1 px-1">
        {products.map((product) => {
          const hasDiscount = product.is_on_sale && product.sale_price && product.sale_price < product.price;
          const displayPrice = hasDiscount ? product.sale_price! : product.price;
          const discountPct = hasDiscount ? Math.round((1 - product.sale_price! / product.price) * 100) : 0;
          return (
            <a
              key={product.id}
              href={`/productos/${product.slug}`}
              className="flex-shrink-0 w-36 sm:w-44 group"
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.02] border border-white/5 mb-2.5 group-hover:border-white/15 transition-all">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                {hasDiscount && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    -{discountPct}%
                  </span>
                )}
              </div>
              <h3 className="text-xs text-gray-300 group-hover:text-white transition-colors line-clamp-2 leading-tight mb-1">
                {product.name}
              </h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-gold-500 font-serif">
                  {formatPrice(displayPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-[10px] text-gray-600 line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
