/**
 * ============================================================================
 * Supabase Client & Database Types
 * ============================================================================
 * Cliente público para operaciones de lectura desde el frontend
 * Para operaciones de escritura, usa las funciones de auth.ts con service_role
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Cliente público de Supabase (anon key)
 * Úsalo para lecturas públicas (productos, categorías)
 * NO lo uses para operaciones de escritura de admin
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
});

/**
 * @deprecated Use createPublicSupabaseClient() o createServerSupabaseClient() from auth.ts instead
 */
export function createServerSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Gender {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Color {
  id: string;
  name: string;
  slug: string;
  hex_code: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  display_order: number;
  parent_id?: string;
  gender_id?: string;
  level: number;
  category_type: 'main' | 'subcategory' | 'style';
  created_at: string;
  updated_at: string;
  gender?: Gender;
  parent?: Category;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color_id?: string;
  size: string;
  stock: number;
  price_adjustment: number;
  images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  color?: Color;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number; // En céntimos
  stock: number;
  stock_by_size?: Record<string, number>; // Stock por talla: {"S": 10, "M": 15, "L": 8}
  category_id?: string;
  images: string[];
  sizes: string[];
  featured: boolean;
  is_active: boolean;
  sku?: string;
  weight_grams?: number;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Nuevos campos
  gender_id?: string;
  color_ids: string[];
  available_sizes: string[];
  material?: string;
  care_instructions?: string;
  is_new: boolean;
  is_on_sale: boolean;
  is_sustainable?: boolean;
  color?: string;
  sale_price?: number;
  popularity_score: number;
  sales_count: number;
  // Relaciones
  category?: Category;
  gender?: Gender;
  variants?: ProductVariant[];
}

export interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state?: string;
  shipping_postal_code: string;
  shipping_country: string;
  subtotal_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  payment_method?: string;
  notes?: string;
  admin_notes?: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_sku?: string;
  product_image?: string;
  size: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_user_id?: string;
  action: string;
  table_name: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}
