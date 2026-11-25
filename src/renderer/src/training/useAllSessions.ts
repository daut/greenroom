import type { TrainingSession } from "@shared/training";
import { useEffect, useState } from "react";

/** Every saved session, for habits carried across sessions. Loaded once per mount. */
export function useAllSessions(): TrainingSession[] | null {
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  useEffect(() => {
    window.greenroom.sessions
      .list()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);
  return sessions;
}
