import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWishlist() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: ids = [] } = useQuery({
    queryKey: ["wishlist", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("wishlists").select("product_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.product_id as string);
    },
  });

  const has = (productId: string) => ids.includes(productId);

  async function toggle(productId: string) {
    if (!userId) return false;
    if (has(productId)) {
      await supabase.from("wishlists").delete().eq("product_id", productId).eq("user_id", userId);
      await qc.invalidateQueries({ queryKey: ["wishlist"] });
      await qc.invalidateQueries({ queryKey: ["wishlist-products"] });
      return false;
    }
    await supabase.from("wishlists").insert({ product_id: productId, user_id: userId });
    await qc.invalidateQueries({ queryKey: ["wishlist"] });
    await qc.invalidateQueries({ queryKey: ["wishlist-products"] });
    return true;
  }

  return { ids, has, toggle, userId };
}
