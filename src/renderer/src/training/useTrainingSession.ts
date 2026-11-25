import type { TrainingSession } from "@shared/training";
import { useCallback, useEffect, useState } from "react";

/** Loads one training session and saves every change straight back to disk. */
export function useTrainingSession(id: string) {
  const [session, setSession] = useState<TrainingSession | null | undefined>(undefined);

  useEffect(() => {
    window.greenroom.sessions.get(id).then(setSession);
  }, [id]);

  const update = useCallback((change: (s: TrainingSession) => TrainingSession) => {
    setSession((current) => {
      if (!current) return current;
      const next = change(current);
      void window.greenroom.sessions.save(next);
      return next;
    });
  }, []);

  return { session, update };
}

export type UpdateSession = ReturnType<typeof useTrainingSession>["update"];
