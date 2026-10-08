import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  ShoppingBag, User, LayoutDashboard, Settings, Shield, Info, Mail, Users2,
  MessageCircle, Plus, Menu, X, Home, Bell, Heart, BarChart3, Ticket, Boxes, Wallet, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { FlagToggle } from "@/components/flag-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAdmin } from "@/hooks/use-admin";
import logo from "@/assets/reflect-logo.png";

export function Nav() {
  const { count } = useCart();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, userId } = useAdmin();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) { setUnread(0); return; }
    let cancelled = false;
    async function load() {
      const { count } = await supabase
        .from("admin_notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isAdmin, pathname]);

  useEffect(() => {
    if (!userId) { setUnreadMsgs(0); return; }
    let cancelled = false;
    async function load() {
      const q = isAdmin
        ? supabase.from("support_messages").select("*", { count: "exact", head: true }).eq("sender_role", "user").eq("read_by_admin", false)
        : supabase.from("support_messages").select("*", { count: "exact", head: true }).eq("user_id", userId!).eq("sender_role", "admin").eq("read_by_user", false);
      const { count } = await q;
      if (!cancelled) setUnreadMsgs(count ?? 0);
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [userId, isAdmin, pathname]);

  const item = (active: boolean) =>
    `sk-tap flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent active:bg-accent ${active ? "bg-accent font-semibold" : ""}`;

  const totalBadge = unread + unreadMsgs;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 truncate font-bold text-base sm:text-lg transition-opacity hover:opacity-70">
          <img src={logo} alt="Reflect" width={36} height={36} className="h-9 w-9 shrink-0 object-contain dark:brightness-0 dark:invert" />
          <span className="truncate">Reflect</span>
        </Link>

        <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
          <Link to="/cart" className="sk-icon-btn relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span
                key={count}
                className="sk-pop absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              >
                {count}
              </span>
            )}
          </Link>
          <FlagToggle />
          <ThemeToggle />
          {email ? (
            <Link to="/settings" aria-label={t("settings")} className="sk-icon-btn group flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent">
              <Settings className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
            </Link>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="sk-icon-btn"><User className="h-4 w-4 mx-1" /> {t("login")}</Button>
            </Link>
          )}
          <button
            onClick={() => setOpen(true)}
            aria-label={t("menu")}
            className="sk-icon-btn relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-accent"
          >
            <Menu className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
            {totalBadge > 0 && <Badge n={totalBadge} />}
          </button>
        </div>
      </div>

      {open && mounted && createPortal(
        <>
          <div className="sk-overlay fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <aside role="dialog" aria-modal="true" aria-label={t("menu")} className="sk-drawer fixed inset-y-0 start-0 z-[61] flex w-[min(20rem,88vw)] max-w-[22rem] flex-col border-e bg-background shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
              <span className="font-bold">{t("menu")}</span>
              <button onClick={() => setOpen(false)} aria-label={t("close")} className="sk-icon-btn flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="sk-stagger flex-1 space-y-1 overflow-y-auto p-3">
              <Section label={t("nav_browse")} />
              <Link to="/" className={item(pathname === "/")}><Home className="h-4 w-4" />{t("products")}</Link>
              <Link to="/community" className={item(pathname.startsWith("/community"))}><Users2 className="h-4 w-4" />{t("community")}</Link>
              <Link to="/about" className={item(pathname === "/about")}><Info className="h-4 w-4" />{t("about")}</Link>
              <Link to="/contact" className={item(pathname === "/contact")}><Mail className="h-4 w-4" />{t("contact")}</Link>

              {email && (
                <>
                  <Section label={t("nav_account")} />
                  <Link to="/dashboard" className={item(pathname.startsWith("/dashboard"))}>
                    <LayoutDashboard className="h-4 w-4" />{t("my_orders")}
                  </Link>
                  <Link to="/wishlist" className={item(pathname === "/wishlist")}>
                    <Heart className="h-4 w-4" />{t("wishlist")}
                  </Link>
                  <Link to="/compare" className={item(pathname === "/compare")}>
                    <span className="h-4 w-4 text-center leading-4">⚖️</span>{t("wishlist") === "Wishlist" ? "Compare" : "المقارنة"}
                  </Link>
                  <Link to="/notifications" className={item(pathname === "/notifications")}>
                    <Bell className="h-4 w-4" />{t("notifications_mine")}
                  </Link>
                  {!isAdmin && (
                    <Link to="/messages" className={item(pathname.startsWith("/messages"))}>
                      <MessageCircle className="h-4 w-4" />{t("messages")}
                      {unreadMsgs > 0 && <Pill n={unreadMsgs} />}
                    </Link>
                  )}
                  <Link to="/settings" className={item(pathname === "/settings")}>
                    <Settings className="h-4 w-4" />{t("settings")}
                  </Link>
                </>
              )}

              {isAdmin && (
                <>
                  <Section label={t("nav_admin")} />
                  <Link to="/add-product" className={item(pathname === "/add-product")}>
                    <Plus className="h-4 w-4" />{t("add_product")}
                  </Link>
                  <Link to="/stats" className={item(pathname === "/stats")}>
                    <BarChart3 className="h-4 w-4" />{t("stats")}
                  </Link>
                  <Link to="/inventory" className={item(pathname === "/inventory")}>
                    <Boxes className="h-4 w-4" />{t("inventory")}
                  </Link>
                  <Link to="/earnings" className={item(pathname === "/earnings")}>
                    <Wallet className="h-4 w-4" />{t("earnings")}
                  </Link>
                  <Link to="/promo-codes" className={item(pathname === "/promo-codes")}>
                    <Ticket className="h-4 w-4" />{t("promo_codes")}
                  </Link>
                  <Link to="/payments" className={item(pathname === "/payments")}>
                    <CreditCard className="h-4 w-4" />Payments
                  </Link>
                  <Link to="/admin" className={item(pathname.startsWith("/admin"))}>
                    <Shield className="h-4 w-4" />{t("admin_panel")}
                    {totalBadge > 0 && <Pill n={totalBadge} />}
                  </Link>
                </>
              )}

            </nav>
          </aside>
        </>,
        document.body
      )}

    </header>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
  );
}

function Pill({ n }: { n: number }) {
  return (
    <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
      {n}
    </span>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
      {n}
    </span>
  );
}
