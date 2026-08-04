import { ExternalLink, Satellite, Radio, Shield, Sun } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  observationLinks,
  type ObservationLink,
} from "@/lib/seismic/observation-links";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GROUP_ICON = {
  authority: Shield,
  satellite: Satellite,
  spaceweather: Sun,
  resonance: Radio,
} as const;

const GROUP_LABEL = {
  authority: "Authority & local",
  satellite: "Satellite / thermal",
  spaceweather: "Space weather",
  resonance: "Resonance feeds",
} as const;

type Props = {
  nodeId: FocusNodeId;
  className?: string;
};

export function ObservationLinks({ nodeId, className }: Props) {
  const links = observationLinks(nodeId);
  const groups = (["authority", "satellite", "spaceweather", "resonance"] as const).filter(
    (g) => links.some((l) => l.group === g),
  );

  return (
    <Card className={cn("obs-links", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Observation links</CardTitle>
        <CardDescription>
          External feeds for this focus node — Tonga-monitor pattern + CF authority pages. Opens
          in a new tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((g) => {
          const Icon = GROUP_ICON[g];
          const items = links.filter((l) => l.group === g);
          return (
            <div key={g}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Icon className="size-3" />
                {GROUP_LABEL[g]}
              </div>
              <div className="obs-links-grid grid gap-1.5">
                {items.map((link) => (
                  <LinkChip key={link.id} link={link} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LinkChip({ link }: { link: ObservationLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-11 items-start justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 transition-colors hover:border-accent/40 hover:bg-secondary/60"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground group-hover:text-accent">
          {link.title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
          {link.subtitle}
        </span>
      </span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-accent" />
    </a>
  );
}
