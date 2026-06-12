import type { DefensiveAlignment } from "@ll-score/contracts";
import { fieldPositionCoordinates } from "@ll-score/field-diagram";

export function Field({ alignments }: { alignments: DefensiveAlignment[] }) {
  const assignments = alignments.flatMap((alignment) => alignment.assignments);
  return (
    <div className="field-card">
      <div className="field">
        <div className="outfield" />
        <div className="infield" />
        {assignments.map((assignment) => {
          const coordinates = fieldPositionCoordinates[
            assignment.position as keyof typeof fieldPositionCoordinates
          ];
          if (!coordinates) return null;
          return (
            <div
              className="fielder"
              key={`${assignment.teamId}-${assignment.playerId}`}
              style={{ left: `${coordinates[0]}%`, top: `${coordinates[1]}%` }}
              title={assignment.displayLabel}
            >
              <span>{assignment.position}</span>
              <small>{assignment.displayLabel.replace(/^#\d+\s*/, "")}</small>
            </div>
          );
        })}
        <div className="off-field bench"><strong>Bench</strong>{assignments.filter((item) => item.position === "BENCH").map((item) => <span key={item.playerId}>{item.displayLabel}</span>)}</div>
        <div className="off-field bullpen"><strong>Bullpen</strong>{assignments.filter((item) => item.position === "BULLPEN").map((item) => <span key={item.playerId}>{item.displayLabel}</span>)}</div>
      </div>
    </div>
  );
}
