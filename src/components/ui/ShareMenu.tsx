import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildShareText,
  buildShareUrl,
  canNativeShare,
  copyToClipboard,
  nativeShare,
  xShareIntentUrl,
  type ShareContext,
} from "@/lib/ui/share";
import { cn } from "@/lib/utils";

type Props = {
  ctx: ShareContext;
  className?: string;
  /** Icon-only (header). */
  compact?: boolean;
};

/**
 * Share: copy link · X intent · native system share (mobile).
 * No third-party social plugins / trackers.
 */
export function ShareMenu({ ctx, className, compact = true }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const url = buildShareUrl(ctx);
  const text = buildShareText(ctx);
  const xUrl = xShareIntentUrl(url, text);

  const onCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) setCopied(true);
  };

  const onNative = async () => {
    const r = await nativeShare({ text, url });
    if (r === "shared") setOpen(false);
    if (r === "unavailable") await onCopy();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(compact ? "h-8 w-8 px-0" : "h-8 gap-1 px-2")}
        onClick={() => setOpen((v) => !v)}
        title="Share monitor"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Share2 className="size-3.5" />
        {!compact && <span className="text-[11px]">Share</span>}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <p className="truncate px-2 py-1 font-mono text-[9px] text-muted-foreground">
            {url.replace(/^https?:\/\//, "").slice(0, 42)}…
          </p>
          <MenuItem
            onClick={() => void onCopy()}
            icon={
              copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )
            }
            label={copied ? "Copied" : "Copy link"}
          />
          <a
            role="menuitem"
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-foreground hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            <XGlyph className="size-3.5 shrink-0" />
            Post on X
          </a>
          {canNativeShare() && (
            <MenuItem
              onClick={() => void onNative()}
              icon={<Link2 className="size-3.5" />}
              label="System share…"
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-foreground hover:bg-secondary"
    >
      {icon}
      {label}
    </button>
  );
}

/** Minimal X logo (no package). */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
