import { useI18n } from "@/lib/i18n";

/** Egypt flag (for Arabic) */
function EgFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 6 4" className={className} aria-hidden="true">
      <rect width="6" height="4" fill="#ce1126" />
      <rect width="6" height="2.67" fill="#fff" />
      <rect width="6" height="1.33" fill="#000" />
      <g transform="translate(3 2)" fill="#c09300">
        <circle r="0.35" />
      </g>
    </svg>
  );
}

/** UK Union Jack (for English) */
function UkFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id="uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" clipPath="url(#uk-t)" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function FlagToggle() {
  const { lang, setLang } = useI18n();
  const next: "ar" | "en" = lang === "ar" ? "en" : "ar";
  return (
    <button
      onClick={() => setLang(next)}
      className="sk-icon-btn flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent transition-colors"
      aria-label="Toggle language"
      title={next === "ar" ? "العربية" : "English"}
    >
      <span key={lang} className="sk-flip-in inline-flex items-center gap-1.5">
        {lang === "ar" ? <EgFlag className="h-4 w-6 rounded-sm" /> : <UkFlag className="h-4 w-6 rounded-sm" />}
        <span className="font-semibold">{lang === "ar" ? "AR" : "EN"}</span>
      </span>
    </button>

  );
}
