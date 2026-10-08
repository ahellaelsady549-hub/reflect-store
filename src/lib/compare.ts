import { useEffect, useState } from "react";

const KEY = "reflect-compare";
const EVT = "reflect-compare-change";
export const COMPARE_MAX = 4;

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  function save(next: string[]) {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
  }
  /** returns "added" | "removed" | "full" */
  function toggle(id: string) {
    const cur = read();
    if (cur.includes(id)) { save(cur.filter((x) => x !== id)); return "removed"; }
    if (cur.length >= COMPARE_MAX) return "full";
    save([...cur, id]); return "added";
  }
  return { ids, has: (id: string) => ids.includes(id), toggle, remove: (id: string) => save(read().filter((x) => x !== id)), clear: () => save([]) };
}
