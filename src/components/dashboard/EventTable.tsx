import type { QuakeEvent } from "@/lib/seismic/types";
import { formatDateTime, formatMag, formatRelativeTime, cn } from "@/lib/utils";
import { magColor } from "@/lib/seismic/colors";

type Props = {
  events: QuakeEvent[];
  selectedId?: string | null;
  onSelect?: (ev: QuakeEvent) => void;
  maxRows?: number;
};

export function EventTable({ events, selectedId, onSelect, maxRows = 80 }: Props) {
  const rows = events.slice(0, maxRows);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-sm">
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mag</th>
              <th className="px-3 py-2 font-medium">Time (UTC)</th>
              <th className="px-3 py-2 font-medium">Depth</th>
              <th className="px-3 py-2 font-medium">Lat</th>
              <th className="px-3 py-2 font-medium">Lon</th>
              <th className="px-3 py-2 font-medium">Place</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No events in this window.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const sel = e.id === selectedId;
                return (
                  <tr
                    key={e.id}
                    onClick={() => onSelect?.(e)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/60",
                      sel && "bg-muted",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: magColor(e.magnitude) }}
                        />
                        {formatMag(e.magnitude)}
                        <span className="font-normal text-muted-foreground">{e.magType}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      <div>{formatDateTime(e.time)}</div>
                      <div className="text-[10px] opacity-80">{formatRelativeTime(e.time)}</div>
                    </td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {e.depthKm.toFixed(1)} km
                    </td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {e.latitude.toFixed(4)}
                    </td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {e.longitude.toFixed(4)}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-1.5 text-muted-foreground">
                      {e.place}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {e.provider}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {events.length > maxRows && (
        <div className="border-t border-border bg-secondary/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          Showing {maxRows} of {events.length} events
        </div>
      )}
    </div>
  );
}
