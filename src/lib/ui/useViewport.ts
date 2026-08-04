import { useEffect, useState } from "react";
import { readViewport, type ViewportState } from "@/lib/ui/breakpoints";

/**
 * Live layout + Visual Viewport state.
 *
 * Listens to:
 * - window resize / orientationchange
 * - visualViewport resize + scroll (URL bar show/hide, keyboard, pinch)
 *
 * Sticky header uses `position: sticky` in normal flow; map height uses
 * `vvHeight` so content fills the *visible* screen on mobile.
 */
export function useViewport(): ViewportState {
  const [vp, setVp] = useState<ViewportState>(() => readViewport());

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(readViewport()));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    // iOS sometimes fires only page scroll when chrome toggles
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  return vp;
}
