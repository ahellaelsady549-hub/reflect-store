import { Instagram, MessageCircle, Music2 } from "lucide-react";

const LINKS = [
  { href: "https://www.instagram.com/x_reflect_x/", label: "Instagram", Icon: Instagram },
  { href: "https://wa.me/201010712416", label: "WhatsApp", Icon: MessageCircle },
  { href: "https://www.tiktok.com/@x.reflect.x", label: "TikTok", Icon: Music2 },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-start">
          <p className="font-bold text-lg">Reflect</p>
          <p className="text-sm text-muted-foreground">Graduation & Apparel 🎓</p>
        </div>
        <div className="flex gap-3">
          {LINKS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="h-11 w-11 rounded-full border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Reflect</p>
      </div>
    </footer>
  );
}
