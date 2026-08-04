/**
 * Shared viewport breakpoints (match Tailwind defaults) + Visual Viewport details.
 * Use for layout logic — not only CSS classes.
 *
 * Visual Viewport API (https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API):
 * - height/width: visible CSS px (shrinks when mobile URL bar / keyboard shows)
 * - offsetTop/offsetLeft: how far visual viewport scrolled within layout viewport
 * - scale: pinch-zoom scale (layout coords × scale ≈ visual)
 * Map height and sticky chrome should prefer vvHeight over innerHeight on mobile.
 */

export const BP = {
  /** phone */
  sm: 640,
  /** tablet / large phone landscape */
  md: 768,
  /** laptop */
  lg: 1024,
  /** desktop */
  xl: 1280,
} as const;

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export type ViewportState = {
  width: number;
  height: number;
  /** short side ≤ 500 or width < md */
  isMobile: boolean;
  /** width < lg */
  isTablet: boolean;
  /** width ≥ lg */
  isDesktop: boolean;
  /** landscape and short height (phone landscape / small laptop) */
  isShort: boolean;
  /** visualViewport height (mobile browser chrome / keyboard) */
  vvHeight: number;
  /** visualViewport width */
  vvWidth: number;
  /** visualViewport.offsetTop — layout offset when URL bar collapses */
  vvOffsetTop: number;
  /** visualViewport.offsetLeft */
  vvOffsetLeft: number;
  /** visualViewport.scale (pinch zoom); 1 = default */
  vvScale: number;
  bp: Breakpoint;
};

export function classifyWidth(w: number): Breakpoint {
  if (w >= BP.xl) return "xl";
  if (w >= BP.lg) return "lg";
  if (w >= BP.md) return "md";
  if (w >= BP.sm) return "sm";
  return "xs";
}

export function readViewport(): ViewportState {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 800,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isShort: false,
      vvHeight: 800,
      vvWidth: 1280,
      vvOffsetTop: 0,
      vvOffsetLeft: 0,
      vvScale: 1,
      bp: "xl",
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const vv = window.visualViewport;
  const vvHeight = vv?.height ?? height;
  const vvWidth = vv?.width ?? width;
  const vvOffsetTop = vv?.offsetTop ?? 0;
  const vvOffsetLeft = vv?.offsetLeft ?? 0;
  const vvScale = vv?.scale ?? 1;
  const bp = classifyWidth(width);
  const isMobile = width < BP.md;
  const isTablet = width >= BP.md && width < BP.lg;
  const isDesktop = width >= BP.lg;
  // Short: limited vertical room for map (landscape phone or short window)
  const isShort = vvHeight < 560 || (height < 500 && width > height);
  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isShort,
    vvHeight,
    vvWidth,
    vvOffsetTop,
    vvOffsetLeft,
    vvScale,
    bp,
  };
}

/** Prefer collapsed chrome when map needs vertical room. */
export function preferCollapsedChrome(v: ViewportState, tabIsMap: boolean): boolean {
  if (!tabIsMap) return false;
  return v.isMobile || v.isShort;
}

/**
 * Usable map height in CSS px.
 * Uses visual viewport (not layout) so mobile URL bar / keyboard shrink the map correctly.
 * chromePx = measured sticky header (+ optional tab bar).
 */
export function mapFillHeightPx(v: ViewportState, chromePx: number, extraPx = 0): number {
  const base = v.vvHeight > 0 ? v.vvHeight : v.height;
  // When pinch-zoomed, height is already in CSS px of the visual viewport
  return Math.max(240, Math.floor(base - chromePx - extraPx));
}
