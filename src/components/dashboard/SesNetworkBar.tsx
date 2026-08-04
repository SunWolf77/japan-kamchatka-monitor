import { ArrowLeft, ExternalLink } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SES_NETWORK,
  resolveNetworkAction,
  sentinelFocusUrl,
  type SesNetworkHop,
} from "@/lib/seismic/ses-handoff";
import { NETWORK_FULL, nodeMonitorTitle } from "@/lib/seismic/branding";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  fromSes: boolean;
  onSelectNode: (id: FocusNodeId) => void;
  onDismissFromSes?: () => void;
  className?: string;
};

/**
 * Compact app switcher — acronyms only; full titles live in tooltips + page H1.
 */
export function SesNetworkBar({
  nodeId,
  fromSes,
  onSelectNode,
  onDismissFromSes,
  className,
}: Props) {
  return (
    <nav
      className={cn("flex shrink-0 items-center gap-1", className)}
      aria-label={`${NETWORK_FULL} app switcher`}
    >
      {fromSes && (
        <a
          href={sentinelFocusUrl(nodeId)}
          className="inline-flex h-7 max-w-[9.5rem] items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-1.5 text-[10px] font-semibold text-accent hover:bg-accent/25 sm:max-w-none sm:px-2 sm:text-[11px]"
          title={`Return to ${NETWORK_FULL}`}
        >
          <ArrowLeft className="size-3 shrink-0" />
          <span className="truncate sm:hidden">Back</span>
          <span className="hidden truncate sm:inline">← {NETWORK_FULL}</span>
        </a>
      )}

      <div
        className="flex items-center rounded-md border border-border bg-card/60 p-0.5"
        role="group"
        aria-label="Switch app or focus node"
      >
        {SES_NETWORK.map((hop) => (
          <HopButton
            key={hop.id}
            hop={hop}
            currentNode={nodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>

      {fromSes && onDismissFromSes && (
        <button
          type="button"
          onClick={onDismissFromSes}
          className="hidden text-[10px] text-muted-foreground hover:text-foreground sm:inline"
          title="Dismiss return banner — stay on this monitor"
        >
          Stay
        </button>
      )}
    </nav>
  );
}

function hopTitle(hop: SesNetworkHop): string {
  if (hop.id === "ses-hub") return NETWORK_FULL;
  if (hop.inAppNode) return nodeMonitorTitle(hop.inAppNode);
  return hop.label;
}

function HopButton({
  hop,
  currentNode,
  onSelectNode,
}: {
  hop: SesNetworkHop;
  currentNode: FocusNodeId;
  onSelectNode: (id: FocusNodeId) => void;
}) {
  const action = resolveNetworkAction(hop, currentNode);
  const active =
    action.kind === "current" ||
    (hop.inAppNode != null && hop.inAppNode === currentNode);
  const full = hopTitle(hop);

  const base =
    "inline-flex h-7 min-w-[2rem] items-center justify-center gap-0.5 rounded px-1.5 text-[11px] font-semibold tabular-nums transition-colors sm:px-2";

  if (action.kind === "external") {
    return (
      <a
        href={action.href}
        className={cn(
          base,
          hop.id === "ses-hub"
            ? "text-accent hover:bg-accent/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
        title={full}
        aria-label={full}
      >
        {hop.short}
        {hop.id === "ses-hub" && (
          <ExternalLink className="hidden size-2.5 opacity-60 sm:inline" />
        )}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (action.kind === "in-app") onSelectNode(action.nodeId);
      }}
      className={cn(
        base,
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
      title={full}
      aria-label={full}
      aria-current={active ? "page" : undefined}
    >
      {hop.short}
    </button>
  );
}
