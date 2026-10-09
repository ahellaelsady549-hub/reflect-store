import { Instagram } from "lucide-react";

const LINKS = [
  { href: "https://www.instagram.com/x_reflect_x/", label: "Instagram", icon: <Instagram /> },
  { href: "https://wa.me/201010712416", label: "WhatsApp", icon: <WhatsAppIcon /> },
  { href: "https://www.tiktok.com/@x.reflect.x", label: "TikTok", icon: <TikTokIcon /> },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.2 11.8a8.2 8.2 0 0 1-12.1 7.2L3.5 20l1.1-4.5a8.3 8.3 0 1 1 15.6-3.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 7.8c-.4 0-.8.4-.8.9 0 4.1 4.1 8.2 8.2 8.2.5 0 .9-.4.9-.8v-1.3c0-.3-.2-.6-.5-.7l-1.7-.7c-.3-.1-.6 0-.8.2l-.7.9c-1.3-.6-2.4-1.7-3-3l.9-.7c.2-.2.3-.5.2-.8l-.7-1.7c-.1-.3-.4-.5-.7-.5H8.2Z" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.2 3h3.1c.2 1.7 1.2 3.2 2.8 4v3.2a9 9 0 0 1-2.8-1v6.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.4a3.2 3.2 0 1 0 2.1 3V3Z" transform="translate(-1 .5)" fill="oklch(0.76 0.15 205)" />
      <path d="M14.2 3h3.1c.2 1.7 1.2 3.2 2.8 4v3.2a9 9 0 0 1-2.8-1v6.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.4a3.2 3.2 0 1 0 2.1 3V3Z" transform="translate(.8 -.3)" fill="oklch(0.68 0.22 355)" />
      <path d="M14.2 3h3.1c.2 1.7 1.2 3.2 2.8 4v3.2a9 9 0 0 1-2.8-1v6.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.4a3.2 3.2 0 1 0 2.1 3V3Z" fill="currentColor" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-card mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-start">
          <p className="font-bold text-lg">Reflect</p>
          <p className="text-sm text-muted-foreground">Graduation & Apparel 🎓</p>
        </div>
        <div className="flex gap-3">
          {LINKS.map(({ href, label, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={`footer-social footer-social--${label.toLowerCase()} group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              <span className="footer-social__wash" aria-hidden="true" />
              <span className="footer-social__icon relative z-10 flex h-6 w-6 items-center justify-center transition-transform duration-300 group-hover:scale-110">{icon}</span>
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Reflect</p>
      </div>
    </footer>
  );
}
