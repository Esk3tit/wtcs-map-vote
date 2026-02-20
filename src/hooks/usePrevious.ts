import { useRef, useEffect, useState } from "react";

/**
 * Returns the value from the previous render.
 * Returns undefined on the first render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const currentRef = useRef(value);

  useEffect(() => {
    setPrev(currentRef.current);
    currentRef.current = value;
  }, [value]);

  return prev;
}
