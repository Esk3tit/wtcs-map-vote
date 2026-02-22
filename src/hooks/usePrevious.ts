import { useRef, useEffect } from "react";

/**
 * Returns the value from the previous render.
 * Returns undefined on the first render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  // eslint-disable-next-line react-hooks/refs -- intentional: usePrevious reads ref during render to return the value from the previous render cycle
  return ref.current;
}
