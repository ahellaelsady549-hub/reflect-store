import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Moon, Sun, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import logo from "@/assets/reflect-logo.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "دخول وحساب جديد — Reflect" },
      { name: "description", content: "سجّل دخولك في Reflect عشان تحفظ طلباتك وتتابعها لحد ما توصل." },
      { property: "og:title", content: "دخول وحساب جديد — Reflect" },
      { property: "og:description", content: "سجّل دخولك في Reflect عشان تحفظ طلباتك وتتابعها لحد ما توصل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field =
  "w-full rounded-2xl border bg-muted/60 px-4 py-4 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring/30";

function AuthPage() {
  const { lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const ar = lang === "ar";
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { redirect = "/" } = useSearch({ from: "/auth" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect as "/", replace: true });
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let userId: string | null = null;

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          const r = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (r.error) throw r.error;
          userId = r.data.user?.id ?? null;
        } else {
          userId = data.user?.id ?? null;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        userId = data.user?.id ?? null;
      }

      const adminMessage = "نورتنا يا ادمن يا احسن ادمن فالدنيااا ✨";
      const userMessage = "يا مرحب يا مرحب ده إحنا زارنا النبي ✨";

      if (userId) {
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        toast.success(role ? adminMessage : userMessage);
      } else {
        toast.success(userMessage);
      }

      navigate({ to: redirect as "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<["signin" | "signup", string]> = [
    ["signup", ar ? "حساب جديد" : "Sign up"],
    ["signin", ar ? "تسجيل دخول" : "Sign in"],
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-card shadow-soft md:grid-cols-2">
        <section className="order-2 p-6 sm:p-12 md:order-1">
          <div className="mb-6 flex gap-2">
            <button onClick={toggle} aria-label="Toggle theme"
              className="sk-icon-btn grid h-12 w-12 place-items-center rounded-2xl border bg-card">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={() => setLang(ar ? "en" : "ar")} aria-label="Toggle language"
              className="sk-icon-btn grid h-12 min-w-12 place-items-center rounded-2xl border bg-card px-3 font-bold">
              {ar ? "EN" : "ع"}
            </button>
          </div>

          <div role="tablist" className="mb-8 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5">
            {tabs.map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-xl py-3 text-lg font-bold transition ${mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold">{ar ? "الاسم" : "Name"}</span>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-bold">{ar ? "الإيميل" : "Email"}</span>
              <input className={field} type="email" dir="ltr" placeholder="name@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">{ar ? "الباسورد" : "Password"}</span>
              <div className="relative">
                <input className={`${field} pe-12`} type={showPw ? "text" : "password"} dir="ltr" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>
            <button type="submit" disabled={loading}
              className="bg-cta w-full rounded-2xl py-4 text-lg font-extrabold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60">
              {loading ? "..." : tabs.find(([m]) => m === mode)![1]}
            </button>
          </form>
        </section>

        <section className="bg-panel relative order-1 flex flex-col p-8 text-primary-foreground sm:p-12 md:order-2">
          <div className="flex justify-end">
            <div className="rounded-2xl bg-card p-2">
              <img src={logo} alt="Reflect" className="h-16 w-16 object-contain dark:brightness-0 dark:invert" />
            </div>
          </div>
          <div className="mt-10 flex flex-1 flex-col justify-center text-center md:mt-0">
            <span className="mx-auto mb-5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-2 text-xs font-extrabold tracking-wide">
              REFLECT • GRADUATION & APPAREL
            </span>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              {ar ? "أول خطوة؟ حسابك." : "First step? Your account."}
            </h1>
            <p className="mt-4 text-base opacity-85 sm:text-lg">
              {ar ? "سجّل دخولك عشان تحفظ طلباتك وتتابعها لحد ما توصل 🎓" : "Sign in to save your orders and track them to your door 🎓"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
