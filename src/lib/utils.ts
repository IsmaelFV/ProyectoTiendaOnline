export function formatPrice(price: number | string): string {
  // Convertir a número si es string
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  // Siempre dividir por 100 para convertir de centavos a euros
  // (asumimos que todos los precios vienen en centavos)
  const euros = numPrice / 100;
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export function getImageUrl(path: string): string {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
