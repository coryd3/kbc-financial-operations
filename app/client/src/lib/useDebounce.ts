import { useEffect, useState } from "react";

// Returns a value that only updates after it has stopped changing for
// `delayMs`. Used to avoid firing a server request on every keystroke.
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
