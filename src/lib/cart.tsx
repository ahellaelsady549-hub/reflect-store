import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number; // price after discount
  image_url: string | null;
  quantity: number;
  size?: string | null;
  max?: number | null;
};

export function itemKey(i: { id: string; size?: string | null }) {
  return `${i.id}::${i.size ?? ""}`;
}

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "shop_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add: CartContextValue["add"] = (item, qty = 1) => {
    setItems((prev) => {
      const key = itemKey(item);
      const found = prev.find((p) => itemKey(p) === key);
      if (found) {
        return prev.map((p) =>
          itemKey(p) === key
            ? { ...p, quantity: cap(p.quantity + qty, p.max ?? item.max ?? null) }
            : p,
        );
      }
      return [...prev, { ...item, quantity: cap(qty, item.max ?? null) }];
    });
  };

  const remove = (key: string) => setItems((prev) => prev.filter((p) => itemKey(p) !== key));
  const setQty = (key: string, qty: number) =>
    setItems((prev) =>
      prev.map((p) => (itemKey(p) === key ? { ...p, quantity: cap(Math.max(1, qty), p.max ?? null) } : p)),
    );
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

function cap(n: number, max: number | null) {
  if (max == null || max <= 0) return n;
  return Math.min(n, max);
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function formatEGP(n: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(n);
}
