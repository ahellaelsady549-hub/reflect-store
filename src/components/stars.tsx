import { Star } from "lucide-react";
import { useState } from "react";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <div className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= rounded ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-muted-foreground"}
        />
      ))}
    </div>
  );
}

export function StarsInput({ value, onChange, size = 24 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="inline-flex items-center gap-1" dir="ltr" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
          aria-label={`${i} stars`}
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= active ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
}
