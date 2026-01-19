import { atom, computed } from 'nanostores';
import { persistentMap, persistentAtom } from '@nanostores/persistent';
import { supabase } from '@lib/supabase';
import { currentUserId, isAuthenticated } from './session';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  image?: string;
  slug: string;
  category?: {
    name: string;
    slug: string;
  };
  gender?: {
    name: string;
    slug: string;
  };
}

// ============================================================================
// CLIENT CART ID: identificador estable por dispositivo/navegador
// ============================================================================
function generateClientCartId(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return 'client_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// ID estable: no cambia al cerrar sesión, evita compartir entre usuarios
const clientCartId = persistentAtom<string>(
  'client_cart_id',
  typeof window !== 'undefined' ? generateClientCartId() : '',
  {
    encode: (value) => value,
    decode: (value) => value || generateClientCartId(),
  }
);

// Trackear última cuenta que usó este dispositivo (para aislar carritos guest)
const lastCartOwner = persistentAtom<string>(
  'last_cart_owner',
  '',
  {
    encode: (value) => value,
    decode: (value) => value || '',
  }
);

console.log('🛒 [CART INIT] Client Cart ID:', typeof window !== 'undefined' ? clientCartId.get() : 'SSR');
console.log('🛒 [CART INIT] Last Cart Owner:', typeof window !== 'undefined' ? lastCartOwner.get() || 'ninguno' : 'SSR');

// Escuchar evento de limpieza de lastCartOwner desde session.ts
if (typeof window !== 'undefined') {
  window.addEventListener('lastCartOwnerCleared', () => {
    console.log('🛒 [CART] Evento lastCartOwnerCleared recibido - forzando recarga');
    lastCartOwner.set('');
    console.log('🛒 [CART] Last Cart Owner reseteado a:', lastCartOwner.get() || 'ninguno');
  });
}

// LocalStorage cart: Cada sesión de invitado tiene su PROPIO carrito
// Pero persiste aunque cierre el navegador (LA MISMA SESIÓN)
let localCart: ReturnType<typeof persistentMap<Record<string, CartItem>>>;

function createLocalCart(id: string) {
  const cartKey = `cart:guest:${id}`;
  let cartData = {};
  try {
    const storedCart = typeof window !== 'undefined' ? localStorage.getItem(cartKey) : null;
    if (storedCart) {
      cartData = JSON.parse(storedCart);
      console.log('🛒 [CART INIT] Carrito recuperado de sesión anterior:', Object.keys(cartData).length, 'items');
    }
  } catch (e) {
    console.warn('🛒 [CART INIT] Error al cargar carrito:', e);
  }
  const map = persistentMap<Record<string, CartItem>>(cartKey, cartData, {
    encode: JSON.stringify,
    decode: JSON.parse,
  });
  console.log('🛒 [CART INIT] Inicializando localStorage con key:', cartKey);
  return map;
}

if (typeof window !== 'undefined') {
  localCart = createLocalCart(clientCartId.get());
} else {
  // Fallback para SSR
  console.log('🛒 [CART INIT] SSR - usando dummy store');
  localCart = persistentMap<Record<string, CartItem>>('cart:ssr', {}, {
    encode: JSON.stringify,
    decode: JSON.parse,
  });
}

// ============================================================================
// STORES: Estado del carrito
// ============================================================================
export const cartItems = atom<Record<string, CartItem>>({});
export const isCartOpen = atom<boolean>(false);
export const isLoadingCart = atom<boolean>(false);

// Stores derivados
export const cartCount = computed(cartItems, (items) => {
  return Object.values(items).reduce((total, item) => total + item.quantity, 0);
});

export const cartTotal = computed(cartItems, (items) => {
  return Object.values(items).reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
});

// Exponer para debugging (solo en desarrollo)
if (typeof window !== 'undefined') {
  (window as any).debugCart = {
    currentUserId,
    isAuthenticated,
    cartItems,
    clientCartId,
    localCart
  };
  console.log('🐛 [DEBUG] Cart stores expuestos en window.debugCart');
}

// ============================================================================
// INICIALIZACIÓN: Una sola vez al montar el cliente
// ============================================================================
let isCartInitialized = false;
let lastMigratedUserId: string | null = null;

export async function initializeCart() {
  if (isCartInitialized) {
    console.log('🛒 [CART] Ya inicializado, skipping...');
    return;
  }

  if (typeof window === 'undefined') {
    console.log('🛒 [CART] SSR - skipping initialization');
    return;
  }

  isCartInitialized = true;
  console.log('🛒 [CART] ========== INICIALIZANDO CARRITO ==========');

  // Cargar items desde localStorage primero
  const localItems = localCart.get();
  console.log('🛒 [CART] Items en localStorage:', Object.keys(localItems).length);
  cartItems.set(localItems); // ✅ CARGAR INMEDIATAMENTE

  // Sincronizar con DB si está autenticado
  const userId = currentUserId.get();
  
  if (userId) {
    console.log('🛒 [CART] ✅ Usuario AUTENTICADO detectado:', userId);
    await loadCartFromDatabase(userId);
  } else {
    console.log('🛒 [CART] ❌ Usuario NO autenticado - usando carrito anónimo');
  }

  console.log('🛒 [CART] ========== INICIALIZACIÓN COMPLETADA ==========');
}

// ============================================================================
// LISTENER: Sincronizar carrito cuando cambia la autenticación
// ============================================================================
let isProcessingAuthChange = false;

if (typeof window !== 'undefined') {
  // Suscribirse a cambios de autenticación
  currentUserId.subscribe((userId) => {
    if (isProcessingAuthChange) {
      console.log('🛒 [CART] ⚠️  Cambio de auth duplicado - ignorando');
      return;
    }

    isProcessingAuthChange = true;

    (async () => {
      try {
        console.log('🛒 [CART] ========== AUTH CHANGE DETECTED ==========');
        console.log('🛒 [CART] Nueva sesión de usuario:', userId || 'anónimo');

        if (userId) {
          // Usuario hizo LOGIN: verificar si es diferente al último usuario
          const previousOwner = lastCartOwner.get();
          console.log('🛒 [CART] ✅ LOGIN - Usuario:', userId);
          console.log('🛒 [CART] Último propietario:', previousOwner || 'ninguno');
          
          // Si es un usuario DIFERENTE, regenerar client_cart_id (aislar carrito guest)
          if (previousOwner && previousOwner !== userId) {
            console.log('🛒 [CART] ⚠️  Usuario diferente detectado - regenerando client_cart_id');
            
            // Limpiar localStorage del usuario anterior
            const oldCartKey = `cart:guest:${clientCartId.get()}`;
            try {
              localStorage.removeItem(oldCartKey);
              console.log('🛒 [CART] Limpiado carrito anterior:', oldCartKey);
            } catch (e) {
              console.warn('🛒 [CART] Error limpiando carrito anterior:', e);
            }
            
            // Generar nuevo ID y carrito limpio
            const newId = generateClientCartId();
            clientCartId.set(newId);
            localCart = createLocalCart(newId);
            localCart.set({});
            console.log('🛒 [CART] Nuevo client_cart_id:', newId.substring(0, 12) + '...');
          }
          
          const localItems = localCart.get();
          const itemsToMigrate = Object.values(localItems);
          
          if (itemsToMigrate.length > 0) {
            console.log('🛒 [CART] Migrando', itemsToMigrate.length, 'items a la base de datos');
            await migrateLocalCartToDatabase(userId);
            // Limpia carrito guest para evitar que otro usuario lo herede
            localCart.set({});
            console.log('🛒 [CART] Carrito guest limpiado tras migración');
          }

          // Cargar carrito desde DB
          console.log('🛒 [CART] Cargando carrito desde base de datos...');
          await loadCartFromDatabase(userId);
          
          // Marcar este usuario como último propietario
          lastCartOwner.set(userId);
          lastMigratedUserId = userId;
          
          console.log('🛒 [CART] ✅ Login completado');
        } else {
          // Usuario hizo LOGOUT: mantener carrito guest del dispositivo
          console.log('🛒 [CART] ✅ LOGOUT - Manteniendo carrito guest');
          console.log('🛒 [CART] Último propietario del carrito:', lastCartOwner.get() || 'ninguno');
          
          // NO regenerar client_cart_id (mantener el carrito guest del dispositivo)
          // Restaurar desde localStorage
          const localItems = localCart.get();
          cartItems.set(localItems);
          
          console.log('🛒 [CART] Carrito guest restaurado con', Object.keys(localItems).length, 'items');
          lastMigratedUserId = null;
        }
      } catch (error) {
        console.error('🛒 [CART] ❌ Error en cambio de autenticación:', error);
      } finally {
        setTimeout(() => {
          isProcessingAuthChange = false;
          console.log('🛒 [CART] Flag isProcessingAuthChange reseteado');
        }, 50);
      }
    })();
  });
}

// ============================================================================
// FUNCIONES DE BASE DE DATOS
// ============================================================================
async function loadCartFromDatabase(userId: string) {
  console.log('🛒 [CART] Cargando carrito desde DB para user:', userId);
  isLoadingCart.set(true);
  
  try {
    const { data, error } = await supabase.rpc('get_cart_with_products', {
      p_user_id: userId
    });

    if (error) {
      console.error('🛒 [CART ERROR] Error llamando get_cart_with_products:', error);
      throw error;
    }

    console.log('🛒 [CART] Datos recibidos de DB:', data);

    // Convertir resultado a formato de cartItems
    const items: Record<string, CartItem> = {};
    data?.forEach((item: any) => {
      const cartKey = `${item.product_id}-${item.size}`;
      items[cartKey] = {
        id: item.product_id,
        name: item.product_name,
        price: item.product_price,
        quantity: item.quantity,
        size: item.size,
        image: item.product_image,
        slug: item.product_slug,
      };
    });

    console.log('🛒 [CART] Items procesados:', Object.keys(items).length);
    cartItems.set(items);
  } catch (error) {
    console.error('🛒 [CART ERROR] Error loading cart from database:', error);
    // Fallback a localStorage en caso de error
    const localItems = localCart.get();
    console.log('🛒 [CART] Fallback a localStorage con', Object.keys(localItems).length, 'items');
    cartItems.set(localItems);
  } finally {
    isLoadingCart.set(false);
  }
}

async function migrateLocalCartToDatabase(userId: string) {
  const localItems = localCart.get();
  const itemsArray = Object.values(localItems);

  if (itemsArray.length === 0) return;

  try {
    // Agregar cada item del localStorage al carrito de DB
    for (const item of itemsArray) {
      await supabase.rpc('add_to_cart', {
        p_user_id: userId,
        p_product_id: item.id,
        p_size: item.size,
        p_quantity: item.quantity
      });
    }

    // Limpiar localStorage después de migrar
    localCart.set({});
  } catch (error) {
    console.error('Error migrating local cart to database:', error);
  }
}

// ============================================================================
// FUNCIONES PÚBLICAS: Add, Remove, Update, Clear
// ============================================================================
export async function addToCart(product: {
  id: string;
  name: string;
  price: number;
  size: string;
  image?: string;
  slug: string;
  category?: {
    name: string;
    slug: string;
  };
  gender?: {
    name: string;
    slug: string;
  };
}) {
  const cartKey = `${product.id}-${product.size}`;
  const userId = currentUserId.get();

  console.log('🛒 [CART] ========== addToCart INICIO ==========');
  console.log('🛒 [CART] currentUserId.get():', userId);
  console.log('🛒 [CART] Tipo:', userId ? 'Usuario autenticado' : 'Usuario invitado');
  console.log('🛒 [CART] Producto:', product.name, 'Talla:', product.size);
  console.log('🛒 [CART] Cart Key:', cartKey);

  if (userId) {
    // Usuario autenticado: usar Supabase
    console.log('🛒 [CART] ✅ RUTA: Agregando a SUPABASE DB...');
    console.log('🛒 [CART] Parámetros RPC:', {
      p_user_id: userId,
      p_product_id: product.id,
      p_size: product.size,
      p_quantity: 1
    });
    
    try {
      const { data, error } = await supabase.rpc('add_to_cart', {
        p_user_id: userId,
        p_product_id: product.id,
        p_size: product.size,
        p_quantity: 1
      });

      console.log('🛒 [CART] Respuesta RPC:', { data, error });
      if (error) {
        console.error('🛒 [CART ERROR] ❌ Error en RPC add_to_cart:', error);
        throw error;
      }

      // Recargar carrito desde DB
      console.log('🛒 [CART] Recargando carrito desde DB...');
      await loadCartFromDatabase(userId);
    } catch (error) {
      console.error('🛒 [CART ERROR] Error adding to cart:', error);
      return;
    }
  } else {
    // Usuario no autenticado: usar localStorage
    console.log('🛒 [CART] ✅ RUTA: Agregando a LOCALSTORAGE...');
    console.log('🛒 [CART] Client Cart ID actual:', clientCartId.get());
    
    const currentItems = localCart.get();
    console.log('🛒 [CART] Items actuales en localStorage:', Object.keys(currentItems).length);
    
    if (currentItems[cartKey]) {
      console.log('🛒 [CART] Item ya existe, incrementando cantidad');
      localCart.setKey(cartKey, {
        ...currentItems[cartKey],
        quantity: currentItems[cartKey].quantity + 1,
      });
    } else {
      console.log('🛒 [CART] Nuevo item, agregando al carrito');
      localCart.setKey(cartKey, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        size: product.size,
        image: product.image,
        slug: product.slug,
        category: product.category,
        gender: product.gender,
      });
    }
    
    const updatedItems = localCart.get();
    cartItems.set(updatedItems);
    console.log('🛒 [CART] ✅ Item agregado a localStorage. Total items:', Object.keys(updatedItems).length);
  }
  
  console.log('🛒 [CART] ========== addToCart FIN ==========');
  isCartOpen.set(true);
}

export async function removeFromCart(cartKey: string) {
  const userId = currentUserId.get();
  
  // CRÍTICO: Separar por el ÚLTIMO guion (UUID contiene guiones)
  const lastDashIndex = cartKey.lastIndexOf('-');
  const productId = cartKey.substring(0, lastDashIndex);
  const size = cartKey.substring(lastDashIndex + 1);

  if (userId) {
    // Usuario autenticado: usar Supabase
    try {
      const { error } = await supabase.rpc('remove_from_cart', {
        p_user_id: userId,
        p_product_id: productId,
        p_size: size
      });

      if (error) throw error;

      // Recargar carrito desde DB
      await loadCartFromDatabase(userId);
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  } else {
    // Usuario no autenticado: usar localStorage
    const currentItems = { ...localCart.get() };
    delete currentItems[cartKey];
    localCart.set(currentItems);
    cartItems.set(currentItems);
  }
}

export async function updateQuantity(cartKey: string, quantity: number) {
  if (quantity <= 0) {
    await removeFromCart(cartKey);
    return;
  }

  const userId = currentUserId.get();
  
  // CRÍTICO: El cartKey es "productId-size", pero productId es UUID con guiones
  // Necesitamos separar solo por el ÚLTIMO guion
  const lastDashIndex = cartKey.lastIndexOf('-');
  const productId = cartKey.substring(0, lastDashIndex);
  const size = cartKey.substring(lastDashIndex + 1);
  
  console.log('🛒 [CART] updateQuantity - cartKey:', cartKey);
  console.log('🛒 [CART] updateQuantity - productId:', productId, 'length:', productId.length);
  console.log('🛒 [CART] updateQuantity - size:', size);
  console.log('🛒 [CART] updateQuantity - quantity:', quantity);

  if (userId) {
    // Usuario autenticado: usar Supabase
    try {
      const { error } = await supabase.rpc('update_cart_item_quantity', {
        p_user_id: userId,
        p_product_id: productId,
        p_size: size,
        p_quantity: quantity
      });

      if (error) throw error;

      // Recargar carrito desde DB
      await loadCartFromDatabase(userId);
    } catch (error) {
      console.error('Error updating cart quantity:', error);
    }
  } else {
    // Usuario no autenticado: usar localStorage
    const currentItems = localCart.get();
    if (currentItems[cartKey]) {
      localCart.setKey(cartKey, {
        ...currentItems[cartKey],
        quantity,
      });
      cartItems.set(localCart.get());
    }
  }
}

export async function clearCart() {
  const userId = currentUserId.get();

  if (userId) {
    // Usuario autenticado: limpiar en Supabase
    try {
      const { error } = await supabase.rpc('clear_cart', {
        p_user_id: userId
      });

      if (error) throw error;

      cartItems.set({});
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  } else {
    // Usuario no autenticado: limpiar localStorage
    localCart.set({});
    cartItems.set({});
  }
}

export function toggleCart() {
  isCartOpen.set(!isCartOpen.get());
}

export function openCart() {
  isCartOpen.set(true);
}

export function closeCart() {
  isCartOpen.set(false);
}

// ============================================================================
// FUNCIÓN PARA LIMPIAR SESIÓN DE INVITADO (útil para testing)
// ============================================================================
export function clearGuestSession() {
  console.log('🛒 [CART] Limpiando sesión de invitado actual');
  const currentGuestId = guestSessionId.get();
  localStorage.removeItem(`cart:${currentGuestId}`);
  
  const newGuestId = generateGuestSessionId();
  guestSessionId.set(newGuestId);
  console.log('🛒 [CART] Nueva sesión de invitado creada:', newGuestId);
  
  cartItems.set({});
}
