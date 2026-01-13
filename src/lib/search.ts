/**
 * ============================================================================
 * Search & Filters - Types & Logic
 * ============================================================================
 * Tipos y funciones para el sistema de búsqueda y filtrado avanzado
 * ============================================================================
 */

import type { Product, Gender, Category, Color } from './supabase';
import { supabase } from './supabase';

// ============================================================================
// TIPOS
// ============================================================================

export interface SearchFilters {
  query?: string;
  gender?: string; // Slug del género
  category?: string; // Slug de categoría
  minPrice?: number; // En céntimos
  maxPrice?: number; // En céntimos
  colors?: string[]; // Slugs de colores
  sizes?: string[]; // Tallas (S, M, L, XL, etc.)
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'popularity' | 'newest';
}

export interface SearchResponse {
  products: ProductCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    appliedFilters: AppliedFilter[];
    availableFilters: AvailableFilters;
  };
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number;
  image: string;
  categoryName?: string;
  genderName?: string;
  isNew: boolean;
  onSale: boolean;
  availableSizes: string[];
}

export interface AppliedFilter {
  type: 'gender' | 'category' | 'price' | 'color' | 'size' | 'inStock' | 'isNew' | 'onSale';
  label: string;
  value: any;
}

export interface AvailableFilters {
  sizes: string[];
  colors: Color[];
  priceRange: {
    min: number;
    max: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
  }>;
}

export interface AutocompleteResult {
  type: 'product' | 'category' | 'gender';
  id: string;
  name: string;
  slug: string;
  image?: string;
  additionalInfo?: string;
}

// ============================================================================
// BÚSQUEDA DE PRODUCTOS
// ============================================================================

export async function searchProducts(
  filters: SearchFilters = {},
  page: number = 1,
  limit: number = 24
): Promise<SearchResponse> {
  try {
    // Convertir slugs a IDs
    let genderId: string | null = null;
    let categoryId: string | null = null;
    let colorIds: string[] | null = null;

    if (filters.gender) {
      const { data } = await supabase
        .from('genders')
        .select('id')
        .eq('slug', filters.gender)
        .single();
      genderId = data?.id || null;
    }

    if (filters.category) {
      const { data } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', filters.category)
        .single();
      categoryId = data?.id || null;
    }

    if (filters.colors && filters.colors.length > 0) {
      const { data } = await supabase
        .from('colors')
        .select('id')
        .in('slug', filters.colors);
      colorIds = data?.map(c => c.id) || null;
    }

    // Llamar a la función de búsqueda en PostgreSQL
    const { data, error } = await supabase.rpc('search_products', {
      search_query: filters.query || null,
      gender_filter: genderId,
      category_filter: categoryId,
      min_price: filters.minPrice || null,
      max_price: filters.maxPrice || null,
      colors_filter: colorIds,
      sizes_filter: filters.sizes || null,
      only_in_stock: filters.inStock || false,
      only_new: filters.isNew || false,
      only_on_sale: filters.onSale || false,
      sort_by: filters.sortBy || 'relevance',
      page_number: page,
      page_size: limit
    });

    if (error) {
      console.error('Error en búsqueda:', error);
      throw error;
    }

    const products = data || [];
    const total = products.length > 0 ? products[0].total_count : 0;

    // Transformar resultados a ProductCard
    const productCards: ProductCard[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      salePrice: p.sale_price,
      image: p.images && p.images.length > 0 ? p.images[0] : '/placeholder-product.jpg',
      categoryName: p.category_name,
      genderName: p.gender_name,
      isNew: p.is_new,
      onSale: p.is_on_sale,
      availableSizes: p.available_sizes || []
    }));

    // Obtener filtros disponibles
    const availableFilters = await getAvailableFilters(genderId, categoryId);

    // Generar filtros aplicados
    const appliedFilters = buildAppliedFilters(filters);

    return {
      products: productCards,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit)
      },
      filters: {
        appliedFilters,
        availableFilters
      }
    };
  } catch (error) {
    console.error('Error en searchProducts:', error);
    throw error;
  }
}

// ============================================================================
// AUTOCOMPLETADO
// ============================================================================

export async function autocompleteSearch(
  query: string,
  limit: number = 5
): Promise<AutocompleteResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const { data, error } = await supabase.rpc('autocomplete_search', {
      search_query: query,
      limit_results: limit
    });

    if (error) {
      console.error('Error en autocomplete:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      type: item.type,
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      additionalInfo: item.additional_info
    }));
  } catch (error) {
    console.error('Error en autocompleteSearch:', error);
    return [];
  }
}

// ============================================================================
// FILTROS DISPONIBLES
// ============================================================================

export async function getAvailableFilters(
  genderId?: string | null,
  categoryId?: string | null
): Promise<AvailableFilters> {
  try {
    const { data, error } = await supabase.rpc('get_available_filters', {
      gender_filter: genderId || null,
      category_filter: categoryId || null
    });

    if (error) {
      console.error('Error obteniendo filtros:', error);
      return {
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 10000 },
        categories: []
      };
    }

    return {
      sizes: data?.sizes || [],
      colors: data?.colors || [],
      priceRange: data?.priceRange || { min: 0, max: 10000 },
      categories: data?.categories || []
    };
  } catch (error) {
    console.error('Error en getAvailableFilters:', error);
    return {
      sizes: [],
      colors: [],
      priceRange: { min: 0, max: 10000 },
      categories: []
    };
  }
}

// ============================================================================
// ÁRBOL DE CATEGORÍAS
// ============================================================================

export async function getCategoryTree(genderId?: string): Promise<Category[]> {
  try {
    const { data, error } = await supabase.rpc('get_category_tree', {
      gender_filter: genderId || null
    });

    if (error) {
      console.error('Error obteniendo árbol de categorías:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en getCategoryTree:', error);
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function buildAppliedFilters(filters: SearchFilters): AppliedFilter[] {
  const applied: AppliedFilter[] = [];

  if (filters.gender) {
    applied.push({
      type: 'gender',
      label: `Género: ${filters.gender}`,
      value: filters.gender
    });
  }

  if (filters.category) {
    applied.push({
      type: 'category',
      label: `Categoría: ${filters.category}`,
      value: filters.category
    });
  }

  if (filters.minPrice || filters.maxPrice) {
    const min = filters.minPrice ? `€${(filters.minPrice / 100).toFixed(2)}` : '€0';
    const max = filters.maxPrice ? `€${(filters.maxPrice / 100).toFixed(2)}` : '∞';
    applied.push({
      type: 'price',
      label: `Precio: ${min} - ${max}`,
      value: { min: filters.minPrice, max: filters.maxPrice }
    });
  }

  if (filters.colors && filters.colors.length > 0) {
    filters.colors.forEach(color => {
      applied.push({
        type: 'color',
        label: `Color: ${color}`,
        value: color
      });
    });
  }

  if (filters.sizes && filters.sizes.length > 0) {
    filters.sizes.forEach(size => {
      applied.push({
        type: 'size',
        label: `Talla: ${size}`,
        value: size
      });
    });
  }

  if (filters.inStock) {
    applied.push({
      type: 'inStock',
      label: 'Solo con stock',
      value: true
    });
  }

  if (filters.isNew) {
    applied.push({
      type: 'isNew',
      label: 'Novedades',
      value: true
    });
  }

  if (filters.onSale) {
    applied.push({
      type: 'onSale',
      label: 'En oferta',
      value: true
    });
  }

  return applied;
}

// ============================================================================
// FORMATO DE PRECIO
// ============================================================================

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function formatPriceRange(min: number, max: number): string {
  return `${formatPrice(min)} - ${formatPrice(max)}`;
}
