import { useEffect } from "react";

/**
 * Reference-counted body scroll lock with scrollbar compensation.
 *
 * Multiple overlays can independently request scroll lock.
 * The lock is only released when all callers deactivate.
 */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      savedPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = Math.max(
        0,
        window.innerWidth - document.documentElement.clientWidth,
      );
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [active]);
}
