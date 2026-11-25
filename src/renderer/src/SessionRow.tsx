import { isFinished, phaseState, type TrainingSession } from "@shared/training";
import { trainingById } from "@shared/trainings";
import { latestScore } from "@shared/trends";
import { shortDate } from "./text";

export function SessionRow({ session, onOpen }: { session: TrainingSession; onOpen: () => void }) {
  const def = trainingById(session.trainingId);
  const score = def ? latestScore(def, session) : null;
  return (
    <button type="button" className="card-row" onClick={onOpen}>
      <span className="script-speaker">{shortDate(session.updatedAt)}</span>
      <span className="card-prompt">
        {session.title}
        <span className="item-detail">{def?.title ?? session.trainingId}</span>
      </span>
      <span className="row-status">
        {score !== null && (
          <span className="row-score" title="Latest overall score">
            {score.toFixed(1)}
          </span>
        )}
        <Progress session={session} />
      </span>
    </button>
  );
}

function Progress({ session }: { session: TrainingSession }) {
  if (isFinished(session)) return <span className="stamp ok">Finished</span>;
  const def = trainingById(session.trainingId);
  const total = def?.phases.length ?? 0;
  const done = def ? def.phases.filter((p) => phaseState(def, session, p.id) === "done").length : 0;
  return (
    <span className={done === total && total > 0 ? "stamp" : "stamp pending"}>
      {done} of {total} acts
    </span>
  );
}
