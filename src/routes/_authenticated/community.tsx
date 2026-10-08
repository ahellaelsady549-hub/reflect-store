import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EyeOff, Eye, Trash2, Flag, Send, MessageSquare, ImagePlus, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { sanitizeImageUrl } from "@/lib/image-safety";

// Resize to max 1200px and encode as WebP to keep posts light on mobile.
async function compressImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", 0.8);
}

export const Route = createFileRoute("/_authenticated/community")({
  component: CommunityPage,
});

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😮"];

type Post = {
  id: string; user_id: string; body: string; hidden: boolean; created_at: string; image_url?: string | null;
  author?: string;
};
type Reply = { id: string; post_id: string; user_id: string; body: string; hidden: boolean; created_at: string; author?: string };
type Reaction = { post_id: string; user_id: string; emoji: string };

function CommunityPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAdmin();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
  const pinchDistanceRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: posts = [] } = useQuery({
    queryKey: ["community-posts"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_posts")
        .select("id,user_id,body,hidden,created_at,image_url").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["community-replies", posts.map((p) => p.id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_replies")
        .select("id,post_id,user_id,body,hidden,created_at")
        .in("post_id", posts.map((p) => p.id))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Reply[];
    },
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["community-reactions", posts.map((p) => p.id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_reactions")
        .select("post_id,user_id,emoji").in("post_id", posts.map((p) => p.id));
      if (error) throw error;
      return data as Reaction[];
    },
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map", posts.length, replies.length],
    enabled: posts.length > 0 || replies.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set([...posts.map((p) => p.user_id), ...replies.map((r) => r.user_id)]));
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || "—"]));
    },
  });

  const reactionsByPost = useMemo(() => {
    const m: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      m[r.post_id] ??= {};
      m[r.post_id][r.emoji] ??= { count: 0, mine: false };
      m[r.post_id][r.emoji].count++;
      if (r.user_id === uid) m[r.post_id][r.emoji].mine = true;
    }
    return m;
  }, [reactions, uid]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const b = newPost.trim();
    if (b.length < 2) return;
    const { error } = await supabase.from("community_posts").insert({ user_id: uid, body: b, image_url: postImage });
    if (error) { toast.error(error.message); return; }
    setNewPost(""); setPostImage(null);
    qc.invalidateQueries({ queryKey: ["community-posts"] });
  }

  async function submitReply(postId: string) {
    if (!uid) return;
    const b = replyText.trim();
    if (!b) return;
    const { error } = await supabase.from("community_replies").insert({ post_id: postId, user_id: uid, body: b });
    if (error) { toast.error(error.message); return; }
    setReplyText(""); setReplyOpen(null);
    qc.invalidateQueries({ queryKey: ["community-replies"] });
  }

  async function toggleReact(postId: string, emoji: string) {
    if (!uid) return;
    const mine = reactionsByPost[postId]?.[emoji]?.mine;
    if (mine) {
      await supabase.from("community_reactions").delete().eq("post_id", postId).eq("user_id", uid).eq("emoji", emoji);
    } else {
      await supabase.from("community_reactions").insert({ post_id: postId, user_id: uid, emoji });
    }
    qc.invalidateQueries({ queryKey: ["community-reactions"] });
  }

  async function report(targetType: "post" | "reply", targetId: string) {
    if (!uid) return;
    const reason = prompt(t("report_reason_prompt")) ?? "";
    const { error } = await supabase.from("community_reports").insert({
      reporter_id: uid, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("reported"));
  }

  async function toggleHide(kind: "post" | "reply", id: string, hidden: boolean) {
    const table = kind === "post" ? "community_posts" : "community_replies";
    const { error } = await supabase.from(table).update({ hidden: !hidden }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: [kind === "post" ? "community-posts" : "community-replies"] });
  }

  async function del(kind: "post" | "reply", id: string) {
    if (!confirm(t("confirm_delete"))) return;
    const table = kind === "post" ? "community_posts" : "community_replies";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: [kind === "post" ? "community-posts" : "community-replies"] });
  }

  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  const clampZoom = (value: number) => Math.min(3, Math.max(1, value));

  const openImageViewer = (src: string) => {
    const safeUrl = sanitizeImageUrl(src);
    if (!safeUrl) return;
    setViewerImage(safeUrl);
    setViewerZoom(1);
    setViewerPan({ x: 0, y: 0 });
    pinchDistanceRef.current = null;
    dragStartRef.current = null;
  };

  const closeImageViewer = () => {
    setViewerImage(null);
    setViewerZoom(1);
    setViewerPan({ x: 0, y: 0 });
    pinchDistanceRef.current = null;
    dragStartRef.current = null;
  };

  const handleViewerTouchStart = (event: React.TouchEvent<HTMLImageElement>) => {
    if (event.touches.length === 2) {
      pinchDistanceRef.current = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      return;
    }

    if (event.touches.length === 1 && viewerZoom > 1) {
      dragStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        panX: viewerPan.x,
        panY: viewerPan.y,
      };
    }
  };

  const handleViewerTouchMove = (event: React.TouchEvent<HTMLImageElement>) => {
    if (event.touches.length === 2 && pinchDistanceRef.current) {
      const nextDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      const ratio = nextDistance / pinchDistanceRef.current;
      setViewerZoom((current) => clampZoom(current * ratio));
      pinchDistanceRef.current = nextDistance;
      return;
    }

    if (event.touches.length === 1 && viewerZoom > 1 && dragStartRef.current) {
      const dx = event.touches[0].clientX - dragStartRef.current.x;
      const dy = event.touches[0].clientY - dragStartRef.current.y;
      setViewerPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
    }
  };

  const handleViewerTouchEnd = () => {
    pinchDistanceRef.current = null;
    dragStartRef.current = null;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("community")}</h1>
        <p className="text-sm text-muted-foreground">{t("community_hint")}</p>
      </div>

      {isAdmin && (
      <form onSubmit={submitPost} className="border rounded-xl bg-card p-4 space-y-2">
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
          placeholder={t("share_thought")}
        />
        {postImage && (
          <div className="relative inline-block">
            <img src={postImage} alt="" className="max-h-48 rounded-lg" />
            <button type="button" onClick={() => setPostImage(null)} className="absolute top-1 end-1 rounded-full bg-background/90 p-1"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ImagePlus className="h-5 w-5" /> صورة / Photo
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
              try { setPostImage(await compressImage(f)); } catch { toast.error("Image error"); }
            }} />
          </label>
          <Button type="submit" size="sm" disabled={newPost.trim().length < 2}>{t("post")}</Button>
        </div>
      </form>
      )}

      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">{t("no_posts_yet")}</p>
        )}
        {posts.map((p) => {
          const postReplies = replies.filter((r) => r.post_id === p.id);
          return (
            <div key={p.id} className={`border rounded-xl bg-card p-4 ${p.hidden ? "opacity-50" : ""}`}>
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold">{(profileMap as any)[p.user_id] || "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString(locale)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => report("post", p.id)} className="text-muted-foreground hover:text-destructive p-1" title={t("report")}>
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                  {(isAdmin || p.user_id === uid) && (
                    <button onClick={() => del("post", p.id)} className="text-muted-foreground hover:text-destructive p-1" title={t("delete_product")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => toggleHide("post", p.id, p.hidden)} className="text-muted-foreground hover:text-foreground p-1" title={p.hidden ? "unhide" : "hide"}>
                      {p.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.body}</p>
              {p.image_url && sanitizeImageUrl(p.image_url) && (
                <button
                  type="button"
                  onClick={() => openImageViewer(p.image_url!)}
                  className="mt-3 block w-full overflow-hidden rounded-lg border bg-muted/30 text-left"
                  aria-label={lang === "ar" ? "فتح الصورة بصورة كاملة" : "Open image in full screen"}
                >
                  <img
                    src={sanitizeImageUrl(p.image_url)!}
                    alt="Community post"
                    loading="lazy"
                    decoding="async"
                    className="max-h-[480px] w-full object-cover transition-transform duration-200 hover:scale-[1.01]"
                  />
                </button>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {(() => {
                  const r = reactionsByPost[p.id]?.["❤️"];
                  return (
                    <button onClick={() => toggleReact(p.id, "❤️")} aria-pressed={!!r?.mine}
                      className={`min-h-9 px-3 rounded-full border flex items-center gap-1 ${r?.mine ? "bg-primary/10 border-primary text-primary" : ""}`}>
                      {r?.mine ? "❤️" : "🤍"} {lang === "ar" ? "أعجبني" : "Like"} · {r?.count ?? 0}
                    </button>
                  );
                })()}
                <button onClick={() => { setReplyOpen(replyOpen === p.id ? null : p.id); setReplyText(""); }}
                  className="min-h-9 px-3 rounded-full border flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> {lang === "ar" ? "تعليقات" : "Comments"} · {postReplies.length}
                </button>
              </div>

              {postReplies.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  {postReplies.map((r) => (
                    <div key={r.id} className={`text-sm bg-muted/50 rounded-md p-2 ${r.hidden ? "opacity-50" : ""}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-semibold">{(profileMap as any)[r.user_id] || "—"}</p>
                          <p className="whitespace-pre-wrap">{r.body}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => report("reply", r.id)} className="text-muted-foreground hover:text-destructive p-1"><Flag className="h-3 w-3" /></button>
                          {(isAdmin || r.user_id === uid) && (
                            <button onClick={() => del("reply", r.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3 w-3" /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => toggleHide("reply", r.id, r.hidden)} className="text-muted-foreground hover:text-foreground p-1">
                              {r.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyOpen === p.id && (
                <div className="mt-3 flex gap-2">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("write_reply")} maxLength={2000}
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                  <Button size="sm" onClick={() => submitReply(p.id)}><Send className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeImageViewer();
          }}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
            <button
              type="button"
              onClick={closeImageViewer}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              aria-label={lang === "ar" ? "إغلاق" : "Close"}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewerZoom((value) => clampZoom(value - 0.5))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                aria-label={lang === "ar" ? "تصغير" : "Zoom out"}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewerZoom((value) => clampZoom(value + 0.5))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                aria-label={lang === "ar" ? "تكبير" : "Zoom in"}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewerZoom(1);
                  setViewerPan({ x: 0, y: 0 });
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                aria-label={lang === "ar" ? "إعادة الضبط" : "Reset"}
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <img
              src={viewerImage}
              alt="Community post in fullscreen"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={() => setViewerZoom((value) => (value > 1 ? 1 : 2))}
              onWheel={(event) => {
                event.preventDefault();
                const direction = event.deltaY < 0 ? 1 : -1;
                setViewerZoom((value) => clampZoom(value + direction * 0.25));
              }}
              onTouchStart={handleViewerTouchStart}
              onTouchMove={handleViewerTouchMove}
              onTouchEnd={handleViewerTouchEnd}
              className="max-h-[92vh] max-w-[92vw] select-none rounded-xl object-contain shadow-2xl transition-transform duration-150"
              style={{
                transform: `scale(${viewerZoom}) translate(${viewerPan.x}px, ${viewerPan.y}px)`,
                touchAction: "none",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
