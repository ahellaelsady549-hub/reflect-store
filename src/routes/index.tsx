import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, formatMoney, CATEGORY_KEYS, categoryLabel } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X, Search } from "lucide-react";
import { ProductCard, type Product, finalPrice as finalP } from "@/components/product-card";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reflect — يوم التخرج؟ خليه شبهك" },
      { name: "description", content: "جاكيتات وتيشيرتات وهوديز تخرج مخصوصة لدفعتك من Reflect." },
      { property: "og:title", content: "Reflect — يوم التخرج؟ خليه شبهك" },
      { property: "og:description", content: "جاكيتات وتيشيرتات وهوديز تخرج مخصوصة لدفعتك من Reflect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Hero({ count, onShop }: { count: number; onShop: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <section className="home-hero bg-panel relative mb-8 overflow-hidden rounded-[2rem] px-6 py-12 text-primary-foreground shadow-soft sm:px-12 sm:py-16">
      <div aria-hidden className="bg-cta absolute -end-20 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl" />
      <div className="relative max-w-2xl">
        <span className="mb-5 inline-block rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-extrabold tracking-wide">
          REFLECT • GRADUATION & APPAREL
        </span>
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">
          {ar ? "يوم التخرج؟ خليه شبهك. 🎓" : "Graduation day? Make it yours. 🎓"}
        </h1>
        <p className="mt-4 text-base opacity-85 sm:text-lg">
          {ar ? "جاكيتات، تيشيرتات وهوديز بتصميم دفعتك — اختار، قيس، واطلب وإنت مرتاح." : "Jackets, tees and hoodies designed for your batch — pick, size, and order easy."}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button onClick={onShop} className="bg-cta rounded-2xl px-7 py-3.5 font-extrabold transition hover:opacity-90 active:scale-95">
            {ar ? "يلا نتسوق 🔥" : "Shop now 🔥"}
          </button>
          {count > 0 && (
            <span className="rounded-2xl border border-primary-foreground/20 px-4 py-3 text-sm font-bold">
              {count} {ar ? "منتج متاح" : "products available"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

type Sort = "newest" | "price_asc" | "price_desc" | "rating";

function Home() {
  const { t, lang } = useI18n();
  const [category, setCategory] = useState<string>("الكل");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [minStars, setMinStars] = useState<number>(0);
  const [sort, setSort] = useState<Sort>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    const selector = ".scroll-reveal, .scroll-reveal-stagger";
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -48px 0px" });
    const observeElements = (root: ParentNode) => {
      if (root instanceof Element && root.matches(selector)) observer.observe(root);
      root.querySelectorAll(selector).forEach((element) => observer.observe(element));
    };
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof Element) observeElements(node);
      }));
    });

    document.documentElement.classList.add("has-scroll-reveal");
    observeElements(document);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      document.documentElement.classList.remove("has-scroll-reveal");
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
        document.documentElement.style.setProperty("--page-progress", String(progress));
      });
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      document.documentElement.style.removeProperty("--page-progress");
    };
  }, []);

  useEffect(() => {
    setVisibleCount(8);
  }, [query, category, priceMin, priceMax, minStars, sort]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products")
        .select("id,name,description,category,image_url,images,sizes,price,discount_percent,stock,rating_avg,rating_count")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const filtered = useMemo(() => {
    const min = priceMin === "" ? -Infinity : Number(priceMin);
    const max = priceMax === "" ? Infinity : Number(priceMax);
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      if (category !== "الكل" && p.category !== category) return false;
      const fp = finalP(p);
      if (fp < min || fp > max) return false;
      if (minStars > 0 && Number(p.rating_avg) < minStars) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => finalP(a) - finalP(b));
    else if (sort === "price_desc") sorted.sort((a, b) => finalP(b) - finalP(a));
    else if (sort === "rating") sorted.sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg));
    return sorted;
  }, [products, query, category, priceMin, priceMax, minStars, sort]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [products, query]);

  const clearFilters = () => {
    setCategory("الكل"); setPriceMin(""); setPriceMax(""); setMinStars(0); setSort("newest"); setQuery("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Hero count={products.length} onShop={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })} />
      <div id="shop" className="scroll-reveal relative mb-4 scroll-mt-24">
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t("search_products")}
          className="w-full rounded-lg border bg-background py-2.5 ps-9 pe-9 text-sm"
          aria-label={t("search")}
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label={t("clear_filters")}
            className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        {focused && query.trim() !== "" && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{t("no_results")}</p>
            ) : (
              suggestions.map((s) => (
                <Link key={s.id} to="/product/$id" params={{ id: s.id }}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                  {s.image_url && <img src={s.image_url} alt="" loading="lazy" decoding="async" className="h-8 w-8 rounded object-cover" />}
                  <span className="line-clamp-1 flex-1">{s.name}</span>
                  <span className="text-xs text-primary">{formatMoney(finalP(s), lang)}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div className="scroll-reveal mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("products")}</h1>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="newest">{t("sort_newest")}</option>
            <option value="price_asc">{t("sort_price_asc")}</option>
            <option value="price_desc">{t("sort_price_desc")}</option>
            <option value="rating">{t("sort_rating")}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal className="h-4 w-4 mx-1" /> {t("filters")}
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 rounded-xl border bg-card p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("category")}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_KEYS.map((c) => (
                <Button key={c} variant={category === c ? "default" : "outline"} size="sm" onClick={() => setCategory(c)}>
                  {categoryLabel(c, lang)}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("from")} (EGP)</p>
              <input type="number" min={0} value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("to")} (EGP)</p>
              <input type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("min_rating")}</p>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <Button key={s} variant={minStars === s ? "default" : "outline"} size="sm" onClick={() => setMinStars(s)}>
                  {s === 0 ? t("all") : `${s}★+`}
                </Button>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mx-1" /> {t("clear_filters")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-10 text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">{t("no_products")}</p>
      ) : (
        <>
          <div className="scroll-reveal-stagger grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {filtered.slice(0, visibleCount).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {filtered.length > visibleCount && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + 8)}>
                {lang === "ar" ? "عرض المزيد" : "Show more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
