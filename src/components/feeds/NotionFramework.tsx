import { BookOpen, ExternalLink } from "lucide-react";
import {
  NOTION_FRAMEWORK,
  NOTION_LIBRARY_HOME,
  type FrameworkDoc,
} from "@/lib/notion/framework";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<FrameworkDoc["group"], string> = {
  ops: "Operations",
  theory: "Theory",
  nodes: "Focus nodes",
  archive: "Archive",
};

export function NotionFramework({ className }: { className?: string }) {
  const groups = (["ops", "nodes", "theory", "archive"] as const).filter((g) =>
    NOTION_FRAMEWORK.some((d) => d.group === g),
  );

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="size-4 text-accent" />
          <CardTitle className="text-sm">Notion SUPT library</CardTitle>
          <Badge variant="outline">Sheppard · SunWolf</Badge>
        </div>
        <CardDescription>
          Curated operational pages from your connected SUPT workspace — framework, SolWatch SOP,
          harmonic learning DB. Open in Notion to edit source docs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <a
          href={NOTION_LIBRARY_HOME}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10"
        >
          Open Notion SUPT library (recents)
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {GROUP_LABEL[g]}
            </div>
            <div className="flex flex-col gap-1">
              {NOTION_FRAMEWORK.filter((d) => d.group === g).map((d) => (
                <a
                  key={d.id}
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-md border border-border bg-secondary/20 px-2.5 py-1.5 transition-colors hover:border-accent/40 hover:bg-secondary/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium group-hover:text-accent">
                      {d.title}
                    </span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{d.note}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
