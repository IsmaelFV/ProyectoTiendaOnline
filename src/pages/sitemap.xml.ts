/**
 * Sitemap XML dinámico
 * Genera un sitemap con todas las páginas públicas + productos activos
 */
import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

const SITE_URL = (import.meta.env.SITE || 'https://mccook8g4sw8kg8kw8kkwoko.victoriafp.online').replace(/\/$/, '');

/** Páginas estáticas públicas con prioridad y frecuencia de cambio */
const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/productos', priority: '0.9', changefreq: 'daily' },
  { path: '/novedades', priority: '0.9', changefreq: 'daily' },
  { path: '/ofertas', priority: '0.9', changefreq: 'daily' },
  { path: '/mujer', priority: '0.8', changefreq: 'weekly' },
  { path: '/hombre', priority: '0.8', changefreq: 'weekly' },
  { path: '/contacto', priority: '0.5', changefreq: 'monthly' },
  { path: '/sobre-nosotros', priority: '0.5', changefreq: 'monthly' },
  { path: '/sostenibilidad', priority: '0.5', changefreq: 'monthly' },
  { path: '/faq', priority: '0.5', changefreq: 'monthly' },
  { path: '/envios', priority: '0.4', changefreq: 'monthly' },
  { path: '/devoluciones', priority: '0.4', changefreq: 'monthly' },
  { path: '/politica-privacidad', priority: '0.3', changefreq: 'yearly' },
  { path: '/terminos', priority: '0.3', changefreq: 'yearly' },
  { path: '/cookies', priority: '0.3', changefreq: 'yearly' },
];

/** Categorías conocidas por género */
const CATEGORY_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/mujer/camisas-blusas', priority: '0.7', changefreq: 'weekly' },
  { path: '/mujer/pantalones', priority: '0.7', changefreq: 'weekly' },
  { path: '/mujer/vestidos', priority: '0.7', changefreq: 'weekly' },
  { path: '/mujer/accesorios', priority: '0.7', changefreq: 'weekly' },
  { path: '/mujer/zapatos', priority: '0.7', changefreq: 'weekly' },
  { path: '/hombre/camisas-blusas', priority: '0.7', changefreq: 'weekly' },
  { path: '/hombre/pantalones', priority: '0.7', changefreq: 'weekly' },
  { path: '/hombre/accesorios', priority: '0.7', changefreq: 'weekly' },
  { path: '/hombre/zapatos', priority: '0.7', changefreq: 'weekly' },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlEntry(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: string,
): string {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];

  // Obtener productos activos con slug y fecha de actualización
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  const entries: string[] = [];

  // Páginas estáticas
  for (const page of STATIC_PAGES) {
    entries.push(buildUrlEntry(`${SITE_URL}${page.path}`, today, page.changefreq, page.priority));
  }

  // Páginas de categorías
  for (const cat of CATEGORY_PAGES) {
    entries.push(buildUrlEntry(`${SITE_URL}${cat.path}`, today, cat.changefreq, cat.priority));
  }

  // Páginas de productos dinámicas
  if (products) {
    for (const product of products) {
      const lastmod = product.updated_at
        ? new Date(product.updated_at).toISOString().split('T')[0]
        : today;
      entries.push(
        buildUrlEntry(`${SITE_URL}/productos/${product.slug}`, lastmod, 'weekly', '0.7'),
      );
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
