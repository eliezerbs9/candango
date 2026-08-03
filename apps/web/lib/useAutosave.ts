import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Debounced autosave. Once `ready` becomes true a baseline snapshot of `value` is captured; any later
 * change schedules `save(value)` after `delay`ms. Returns a status for a "Saving…/Saved" indicator.
 * The caller establishes the baseline at hydration by flipping `ready` true only after state is set.
 */
export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<unknown> | void,
  ready: boolean,
  delay = 900,
): AutosaveStatus {
  const savedRef = useRef<string | null>(null);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const serialized = JSON.stringify(value);

  useEffect(() => {
    // Capture the baseline exactly once, when the editor first becomes ready (hydrated).
    if (ready && savedRef.current === null) savedRef.current = serialized;
  }, [ready, serialized]);

  useEffect(() => {
    if (!ready || savedRef.current === null || serialized === savedRef.current) return;
    setStatus('saving');
    const t = setTimeout(async () => {
      try {
        await save(value);
        savedRef.current = serialized;
        setStatus('saved');
      } catch {
        setStatus('idle');
      }
    }, delay);
    return () => clearTimeout(t);
    // `value`/`save` are read through the latest closure; `serialized` drives the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, ready]);

  return status;
}
