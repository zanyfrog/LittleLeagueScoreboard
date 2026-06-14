"use client";

import { useMemo, useState } from "react";
import type { BaseLocation, BaseState } from "@ll-score/contracts";

interface OccupiedBase {
  runnerId: string;
  displayLabel: string;
  from: "FIRST" | "SECOND" | "THIRD";
}

export function RunnerOutControls({
  state,
  disabled,
  onRecord
}: {
  state: BaseState;
  disabled: boolean;
  onRecord: (
    runnerId: string,
    from: BaseLocation,
    outType: "PICKOFF" | "THROW_OUT",
    fieldingSequence: string
  ) => Promise<void>;
}) {
  const runners = useMemo(
    () =>
      [
        state.first
          ? { ...state.first, from: "FIRST" as const }
          : null,
        state.second
          ? { ...state.second, from: "SECOND" as const }
          : null,
        state.third
          ? { ...state.third, from: "THIRD" as const }
          : null
      ].filter((runner): runner is OccupiedBase => Boolean(runner)),
    [state]
  );
  const [runnerId, setRunnerId] = useState("");
  const [outType, setOutType] = useState<"PICKOFF" | "THROW_OUT">("PICKOFF");
  const [fieldingSequence, setFieldingSequence] = useState("");
  const selectedRunner =
    runners.find((runner) => runner.runnerId === runnerId) ?? runners[0];

  async function record() {
    if (!selectedRunner || !fieldingSequence.trim()) return;
    await onRecord(
      selectedRunner.runnerId,
      selectedRunner.from,
      outType,
      fieldingSequence.trim()
    );
    setRunnerId("");
    setFieldingSequence("");
  }

  return (
    <div className="runner-controls">
      <h3>Runner Out After Play</h3>
      {runners.length === 0 ? (
        <p className="empty">No runners are currently on base.</p>
      ) : (
        <>
          <label>
            Runner
            <select
              value={selectedRunner?.runnerId ?? ""}
              disabled={disabled}
              onChange={(event) => setRunnerId(event.target.value)}
            >
              {runners.map((runner) => (
                <option key={runner.runnerId} value={runner.runnerId}>
                  {runner.displayLabel} on {runner.from.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Out type
            <select
              value={outType}
              disabled={disabled}
              onChange={(event) =>
                setOutType(event.target.value as "PICKOFF" | "THROW_OUT")
              }
            >
              <option value="PICKOFF">Pickoff</option>
              <option value="THROW_OUT">Throw Out</option>
            </select>
          </label>
          <label>
            Fielding sequence
            <input
              value={fieldingSequence}
              disabled={disabled}
              maxLength={80}
              placeholder={outType === "PICKOFF" ? "P to 1B" : "C to 2B"}
              onChange={(event) => setFieldingSequence(event.target.value)}
            />
          </label>
          <button
            disabled={disabled || !fieldingSequence.trim()}
            onClick={() => void record()}
          >
            Record Runner Out
          </button>
        </>
      )}
    </div>
  );
}
