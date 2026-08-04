import { createFileRoute } from "@tanstack/react-router";
import { MonitorApp } from "@/components/dashboard/MonitorApp";
import { emptyCatalog } from "@/lib/seismic/catalog";

/**
 * Ultra-light SSR: ship shell only. Full catalog loads client-side via
 * fetchCatalog (avoids 150KB+ dehydrated swarm/event payload that stalled
 * the live preview proxy).
 */
export const Route = createFileRoute("/")({
  loader: async () => {
    return emptyCatalog({
      nodeId: "japan",
      windowKey: "7d",
      provider: "jma",
    });
  },
  component: HomePage,
  pendingComponent: Pending,
  errorComponent: ErrorView,
});

function HomePage() {
  const data = Route.useLoaderData();
  return <MonitorApp initial={data ?? emptyCatalog()} />;
}

function Pending() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-3 size-8 animate-pulse rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-muted-foreground">Starting Japan–Kamchatka monitor…</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          JMA Bosai authority · tsunami watch · client catalog load
        </p>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: Error }) {
  return (
    <MonitorApp
      initial={emptyCatalog({
        error: error?.message || "Hard route error — showing empty catalog",
      })}
    />
  );
}
