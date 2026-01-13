import { atom, map, computed } from 'nanostores';
import { persistentMap } from '@nanostores/persistent';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  image?: string;
  slug: string;
}

export const cartItems = persistentMap<Record<string, CartItem>>('cart:', {}, {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export const isCartOpen = atom<boolean>(false);

export const cartCount = computed(cartItems, (items) => {
  return Object.values(items).reduce((total, item) => total + item.quantity, 0);
});

export const cartTotal = computed(cartItems, (items) => {
  return Object.values(items).reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
});

export function addToCart(product: {
  id: string;
  name: string;
  price: number;
  size: string;
  image?: string;
  slug: string;
}) {
  const cartKey = `${product.id}-${product.size}`;
  const currentItems = cartItems.get();
  
  if (currentItems[cartKey]) {
    cartItems.setKey(cartKey, {
      ...currentItems[cartKey],
      quantity: currentItems[cartKey].quantity + 1,
    });
  } else {
    cartItems.setKey(cartKey, {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      size: product.size,
      image: product.image,
      slug: product.slug,
    });
  }
  
  isCartOpen.set(true);
}

export function removeFromCart(cartKey: string) {
  const currentItems = { ...cartItems.get() };
  delete currentItems[cartKey];
  cartItems.set(currentItems);
}

export function updateQuantity(cartKey: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(cartKey);
    return;
  }
  
  const currentItems = cartItems.get();
  if (currentItems[cartKey]) {
    cartItems.setKey(cartKey, {
      ...currentItems[cartKey],
      quantity,
    });
  }
}

export function clearCart() {
  cartItems.set({});
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
