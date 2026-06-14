import type { BaseState } from "@ll-score/contracts";

export function Bases({
  state,
  disabled,
  onSteal,
  onCaughtStealing
}: {
  state: BaseState;
  disabled: boolean;
  onSteal: (runnerId: string, from: "FIRST" | "SECOND" | "THIRD", to: "SECOND" | "THIRD" | "HOME") => void;
  onCaughtStealing: (runnerId: string, from: "FIRST" | "SECOND" | "THIRD", attemptedBase: "SECOND" | "THIRD" | "HOME") => void;
}) {
  return (
    <div className="bases-card">
      <h3>On Base</h3>
      <div className="diamond">
        <div className={`base second ${state.second ? "occupied" : ""}`}><span>{state.second?.displayLabel ?? "2"}</span></div>
        <div className={`base third ${state.third ? "occupied" : ""}`}><span>{state.third?.displayLabel ?? "3"}</span></div>
        <div className={`base first ${state.first ? "occupied" : ""}`}><span>{state.first?.displayLabel ?? "1"}</span></div>
        <div className="home-plate" />
      </div>
      <div className="steal-controls">
        <button disabled={disabled || !state.first || Boolean(state.second)} onClick={() => state.first && onSteal(state.first.runnerId, "FIRST", "SECOND")}>Steal 2nd</button>
        <button disabled={disabled || !state.second || Boolean(state.third)} onClick={() => state.second && onSteal(state.second.runnerId, "SECOND", "THIRD")}>Steal 3rd</button>
        <button disabled={disabled || !state.third} onClick={() => state.third && onSteal(state.third.runnerId, "THIRD", "HOME")}>Steal Home</button>
      </div>
      <div className="caught-stealing-controls">
        <button disabled={disabled || !state.first || Boolean(state.second)} onClick={() => state.first && onCaughtStealing(state.first.runnerId, "FIRST", "SECOND")}>Caught stealing 2nd</button>
        <button disabled={disabled || !state.second || Boolean(state.third)} onClick={() => state.second && onCaughtStealing(state.second.runnerId, "SECOND", "THIRD")}>Caught stealing 3rd</button>
        <button disabled={disabled || !state.third} onClick={() => state.third && onCaughtStealing(state.third.runnerId, "THIRD", "HOME")}>Caught stealing home</button>
      </div>
    </div>
  );
}
