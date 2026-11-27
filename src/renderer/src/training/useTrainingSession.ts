import type { TrainingSession } from "@shared/training";
import { useCallback, useEffect, useState } from "react";
import { loadSession, openSession } from "./sessionWrites";

/**
 * Loads one training session and saves every change straight back to disk. While open, changes
 * made elsewhere (`updateSession`) come through here too.
 */
export function useTrainingSession(id: string) {
  const [session, setSession] = useState<TrainingSession | null | undefined>(undefined);

  const update = useCallback((change: (s: TrainingSession) => TrainingSession) => {
    setSession((current) => {
      if (!current) return current;
      const next = change(current);
      void window.greenroom.sessions.save(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    let close = () => {};
    loadSession(id).then((loaded) => {
      if (!active) return;
      setSession(loaded);
      close = openSession(id, update);
    });
    return () => {
      active = false;
      close();
    };
  }, [id, update]);

  return { session, update };
}

export type UpdateSession = ReturnType<typeof useTrainingSession>["update"];
