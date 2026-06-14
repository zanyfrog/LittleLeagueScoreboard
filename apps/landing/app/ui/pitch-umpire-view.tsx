"use client";

import type { ReactNode } from "react";
import type { PitchCall, PlateAppearanceState } from "@ll-score/count-controls";

export interface PitchEntry {
  call?: PitchCall;
  zone: number;
  note: string;
}

interface Props {
  state: PlateAppearanceState;
  pitcherLabel?: string;
  batterHandedness?: string;
  selectedZone: number | null;
  note: string;
  disabled: boolean;
  recentPitches: PitchEntry[];
  awaitingResult: boolean;
  onBasePanel: ReactNode;
  onZoneChange: (zone: number | null) => void;
  onRecordLocation: (zone: number) => void;
  onNoteChange: (note: string) => void;
  onSubmitComment: () => void;
  onRecordResult: (call: PitchCall) => void;
  onUndo: () => void;
}

const actions: Array<{ call: PitchCall; label: string }> = [
  { call: "BALL", label: "Ball" },
  { call: "CALLED_STRIKE", label: "Strike" },
  { call: "SWINGING_STRIKE", label: "Swinging Strike" },
  { call: "FOUL", label: "Foul" },
  { call: "HIT_BY_PITCH", label: "Hit by Pitch" },
  { call: "IN_PLAY", label: "In-Play" }
];

export function PitchUmpireView({
  state,
  pitcherLabel,
  batterHandedness,
  selectedZone,
  note,
  disabled,
  recentPitches,
  awaitingResult,
  onBasePanel,
  onZoneChange,
  onRecordLocation,
  onNoteChange,
  onSubmitComment,
  onRecordResult,
  onUndo
}: Props) {
  return (
    <section className="scorekeeper-view pitch-umpire-view">
      <div className="view-matchup">
        <div><span>Current batter</span><strong>{state.batterLabel}</strong></div>
        <div><span>Bats / Throws</span><strong>{batterHandedness}</strong></div>
        <div><span>Pitcher</span><strong>{pitcherLabel}</strong></div>
        <div><span>Count</span><strong>{state.balls} - {state.strikes}</strong></div>
        <div><span>This at-bat</span><strong>{state.pitchNumber} pitches</strong></div>
      </div>
      <div className={`pitch-view-grid ${awaitingResult ? "result-only" : ""}`}>
        {!awaitingResult ? <div>
          <div className="view-section-title">
            <div><span>Step 1</span><h3>Click pitch location</h3></div>
            <small>{selectedZone ? `Zone ${selectedZone}` : "No location selected"}</small>
          </div>
          <div className="numeric-pitch-map" aria-label="Pitch location zones">
            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((zone) => (
              <button
                key={zone}
                className={`${zone === 5 ? "main-zone" : ""} ${selectedZone === zone ? "selected" : ""}`}
                disabled={disabled || awaitingResult}
                onClick={() => {
                  onZoneChange(zone);
                  onRecordLocation(zone);
                }}
              >
                {zone}
              </button>
            ))}
          </div>
          <p className="rule-note">
            Location does not determine the call. After selecting a location,
            record the official result on the right.
          </p>
        </div> : null}
        <div>
          <div className="view-section-title">
            <div><span>Step 2: official call</span><h3>Record pitch result</h3></div>
            <button className="undo-button" disabled={disabled} onClick={onUndo}>
              Undo Last Action
            </button>
          </div>
          <div className="umpire-actions">
            {actions.map(({ call, label }) => (
              <button key={call} disabled={disabled} onClick={() => onRecordResult(call)}>{label}</button>
            ))}
          </div>
          <p className="rule-note">
            Ball, strike, swinging strike, and foul update the count. The selected
            location is informational and never decides the call.
          </p>
          <div className="scorekeeper-comment">
            <label>Scorekeeper comment
              <textarea rows={2} maxLength={250} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Add a note to the event timeline..." />
            </label>
            <button className="comment-submit" disabled={disabled || !note.trim()} onClick={onSubmitComment}>Submit</button>
          </div>
          <div className="pitch-on-base-panel">
            {onBasePanel}
          </div>
        </div>
      </div>
      <div className="pitch-sequence">
        <h3>Pitch sequence</h3>
        {recentPitches.length === 0 ? <p>No pitches recorded for this batter.</p> : (
          <ol>{[...recentPitches].reverse().map((pitch, index) => <li key={`${pitch.zone}-${index}`}><strong>{pitch.call ? pitch.call.replaceAll("_", " ") : "AWAITING RESULT"}</strong><span>Zone {pitch.zone}</span></li>)}</ol>
        )}
      </div>
    </section>
  );
}
