/**
 * ============================================================================
 * Filters Store - Nano Stores
 * ============================================================================
 * Estado global para filtros de búsqueda y productos
 * ============================================================================
 */

import { atom, map, computed } from 'nanostores';
import type { SearchFilters, ProductCard, AvailableFilters } from '../lib/search';

// ============================================================================
// STORES
// ============================================================================

/**
 * Filtros activos aplicados por el usuario
 */
export const activeFilters = map<SearchFilters>({
  sortBy: 'relevance'
});

/**
 * Resultados de búsqueda
 */
export const searchResults = atom<ProductCard[]>([]);

/**
 * Estado de carga
 */
export const isLoading = atom<boolean>(false);

/**
 * Paginación
 */
export const pagination = map({
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 0
});

/**
 * Filtros disponibles (dinámicos según contexto)
 */
export const availableFilters = atom<AvailableFilters>({
  sizes: [],
  colors: [],
  priceRange: { min: 0, max: 10000 },
  categories: []
});

/**
 * Query de búsqueda actual
 */
export const searchQuery = atom<string>('');

// ============================================================================
// COMPUTED STORES
// ============================================================================

/**
 * Contador de filtros activos (para badge)
 */
export const activeFiltersCount = computed(
  activeFilters,
  (filters) => {
    let count = 0;
    
    if (filters.gender) count++;
    if (filters.category) count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.colors?.length) count += filters.colors.length;
    if (filters.sizes?.length) count += filters.sizes.length;
    if (filters.inStock) count++;
    if (filters.isNew) count++;
    if (filters.onSale) count++;
    
    return count;
  }
);

/**
 * ¿Hay filtros activos?
 */
export const hasActiveFilters = computed(
  activeFiltersCount,
  (count) => count > 0
);

/**
 * URL de búsqueda con parámetros
 */
export const searchURL = computed(
  [activeFilters, pagination],
  (filters, pag) => {
    const params = new URLSearchParams();
    
    if (filters.query) params.set('q', filters.query);
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice) params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString());
    if (filters.colors?.length) params.set('colors', filters.colors.join(','));
    if (filters.sizes?.length) params.set('sizes', filters.sizes.join(','));
    if (filters.inStock) params.set('inStock', 'true');
    if (filters.isNew) params.set('new', 'true');
    if (filters.onSale) params.set('sale', 'true');
    if (filters.sortBy && filters.sortBy !== 'relevance') params.set('sortBy', filters.sortBy);
    if (pag.page > 1) params.set('page', pag.page.toString());
    
    return `/search?${params.toString()}`;
  }
);

// ============================================================================
// ACCIONES
// ============================================================================

/**
 * Aplicar un filtro
 */
export function setFilter(key: keyof SearchFilters, value: any) {
  activeFilters.setKey(key, value);
  // Reset a página 1 cuando se cambia un filtro
  pagination.setKey('page', 1);
}

/**
 * Quitar un filtro
 */
export function removeFilter(key: keyof SearchFilters) {
  const current = activeFilters.get();
  const updated = { ...current };
  delete updated[key];
  activeFilters.set(updated);
  pagination.setKey('page', 1);
}

/**
 * Toggle de filtro booleano
 */
export function toggleFilter(key: 'inStock' | 'isNew' | 'onSale') {
  const current = activeFilters.get();
  activeFilters.setKey(key, !current[key]);
  pagination.setKey('page', 1);
}

/**
 * Agregar color al filtro
 */
export function addColor(colorSlug: string) {
  const current = activeFilters.get();
  const colors = current.colors || [];
  
  if (!colors.includes(colorSlug)) {
    activeFilters.setKey('colors', [...colors, colorSlug]);
    pagination.setKey('page', 1);
  }
}

/**
 * Quitar color del filtro
 */
export function removeColor(colorSlug: string) {
  const current = activeFilters.get();
  const colors = current.colors || [];
  activeFilters.setKey('colors', colors.filter(c => c !== colorSlug));
  pagination.setKey('page', 1);
}

/**
 * Agregar talla al filtro
 */
export function addSize(size: string) {
  const current = activeFilters.get();
  const sizes = current.sizes || [];
  
  if (!sizes.includes(size)) {
    activeFilters.setKey('sizes', [...sizes, size]);
    pagination.setKey('page', 1);
  }
}

/**
 * Quitar talla del filtro
 */
export function removeSize(size: string) {
  const current = activeFilters.get();
  const sizes = current.sizes || [];
  activeFilters.setKey('sizes', sizes.filter(s => s !== size));
  pagination.setKey('page', 1);
}

/**
 * Establecer rango de precios
 */
export function setPriceRange(min?: number, max?: number) {
  if (min !== undefined) activeFilters.setKey('minPrice', min);
  if (max !== undefined) activeFilters.setKey('maxPrice', max);
  pagination.setKey('page', 1);
}

/**
 * Limpiar todos los filtros
 */
export function clearFilters() {
  activeFilters.set({ sortBy: 'relevance' });
  pagination.set({ page: 1, limit: 24, total: 0, totalPages: 0 });
}

/**
 * Establecer resultados de búsqueda
 */
export function setSearchResults(products: ProductCard[]) {
  searchResults.set(products);
}

/**
 * Establecer estado de carga
 */
export function setLoading(loading: boolean) {
  isLoading.set(loading);
}

/**
 * Actualizar paginación
 */
export function setPagination(data: { page: number; limit: number; total: number; totalPages: number }) {
  pagination.set(data);
}

/**
 * Ir a página
 */
export function goToPage(page: number) {
  pagination.setKey('page', page);
}

/**
 * Establecer filtros disponibles
 */
export function setAvailableFilters(filters: AvailableFilters) {
  availableFilters.set(filters);
}

/**
 * Inicializar filtros desde URL params
 */
export function initFiltersFromURL(params: URLSearchParams) {
  const filters: SearchFilters = {
    sortBy: 'relevance'
  };
  
  if (params.get('q')) filters.query = params.get('q')!;
  if (params.get('gender')) filters.gender = params.get('gender')!;
  if (params.get('category')) filters.category = params.get('category')!;
  if (params.get('minPrice')) filters.minPrice = parseInt(params.get('minPrice')!);
  if (params.get('maxPrice')) filters.maxPrice = parseInt(params.get('maxPrice')!);
  if (params.get('colors')) filters.colors = params.get('colors')!.split(',');
  if (params.get('sizes')) filters.sizes = params.get('sizes')!.split(',');
  if (params.get('inStock')) filters.inStock = params.get('inStock') === 'true';
  if (params.get('new')) filters.isNew = params.get('new') === 'true';
  if (params.get('sale')) filters.onSale = params.get('sale') === 'true';
  if (params.get('sortBy')) filters.sortBy = params.get('sortBy') as any;
  
  activeFilters.set(filters);
  
  const page = params.get('page') ? parseInt(params.get('page')!) : 1;
  pagination.setKey('page', page);
}

/**
 * Exportar filtros para API
 */
export function getFiltersForAPI(): SearchFilters {
  return activeFilters.get();
}
