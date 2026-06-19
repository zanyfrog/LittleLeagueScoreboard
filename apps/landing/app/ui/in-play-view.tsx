"use client";

export type LandingZone =
  | "LF" | "LCF" | "RCF" | "RF"
  | "3B" | "SS" | "2B" | "1B" | "P" | "C";

export type InPlayResult =
  | "Ground Out" | "Fly Out" | "Line Out" | "Pop Out"
  | "Single" | "Double" | "Triple" | "Home run"
  | "Reach on Error" | "Fielders choice" | "Sacrifice Fly"
  | "Sacrifice Bunt" | "Interference" | "Other";

interface Props {
  selectedZone: LandingZone | null;
  selectedResult: InPlayResult | null;
  fieldingSequence: string;
  note: string;
  disabled: boolean;
  onZoneChange: (zone: LandingZone | null) => void;
  onResultChange: (result: InPlayResult) => void;
  onFieldingSequenceChange: (sequence: string) => void;
  onNoteChange: (note: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const zones: LandingZone[] = ["LF", "LCF", "RCF", "RF", "3B", "SS", "2B", "1B", "P", "C"];
const results: InPlayResult[] = [
  "Ground Out", "Fly Out", "Line Out", "Pop Out",
  "Single", "Double", "Triple", "Home run",
  "Reach on Error", "Fielders choice", "Sacrifice Fly",
  "Sacrifice Bunt", "Interference", "Other"
];

export function inferLandingZoneFromFieldingSequence(
  sequence: string
): LandingZone | null {
  const firstFielder = sequence.trim().match(/^(1|2|3|4|5|6|7|8|9)\b/)?.[1];
  const positions: Record<string, LandingZone> = {
    "1": "P",
    "2": "C",
    "3": "1B",
    "4": "2B",
    "5": "3B",
    "6": "SS",
    "7": "LF",
    "8": "LCF",
    "9": "RF"
  };
  return firstFielder ? positions[firstFielder] ?? null : null;
}

export function InPlayView({
  selectedZone,
  selectedResult,
  fieldingSequence,
  note,
  disabled,
  onZoneChange,
  onResultChange,
  onFieldingSequenceChange,
  onNoteChange,
  onCancel,
  onSave
}: Props) {
  const needsFieldingSequence =
    selectedResult === "Ground Out" || selectedResult === "Fielders choice";
  const inferredZone =
    needsFieldingSequence
      ? inferLandingZoneFromFieldingSequence(fieldingSequence)
      : null;
  const effectiveZone = selectedZone ?? inferredZone;
  const saveDisabled =
    disabled ||
    !effectiveZone ||
    !selectedResult ||
    (needsFieldingSequence && !fieldingSequence.trim()) ||
    (selectedResult === "Other" && !note.trim());
  return (
    <section className="scorekeeper-view in-play-view">
      <div className="view-section-title">
        <div><span>Ball in play</span><h3>Where did the ball land?</h3></div>
        <button className="ghost-button" onClick={onCancel}>Back to Pitch / Umpire</button>
      </div>
      <div className="in-play-grid">
        <div>
          <div className="landing-field" aria-label="Field landing location">
            {zones.map((zone) => <button key={zone} className={`landing-zone zone-${zone.replace("1B", "first").replace("2B", "second").replace("3B", "third")} ${selectedZone === zone ? "selected" : ""}`} disabled={disabled} onClick={() => onZoneChange(zone)}>{zone}</button>)}
          </div>
          <div className="location-readout">
            {selectedZone
              ? `Selected: ${selectedZone}`
              : inferredZone
                ? `Inferred from fielding sequence: ${inferredZone}`
                : "Select a field location, or enter a numbered fielding sequence"}
          </div>
        </div>
        <div>
          <div className="view-section-title"><div><span>Result of play</span><h3>How was this play scored?</h3></div></div>
          <div className="play-result-grid">
            {results.map((result) => <button key={result} className={selectedResult === result ? "selected" : ""} disabled={disabled} onClick={() => onResultChange(result)}>{result}</button>)}
          </div>
          {needsFieldingSequence ? (
            <label className="scorekeeper-note">
              Fielding sequence
              <input
                maxLength={80}
                value={fieldingSequence}
                disabled={disabled}
                onChange={(event) => {
                  const sequence = event.target.value;
                  onFieldingSequenceChange(sequence);
                  const zone = inferLandingZoneFromFieldingSequence(sequence);
                  if (zone) onZoneChange(zone);
                }}
                placeholder={
                  selectedResult === "Fielders choice"
                    ? "Examples: 6 to 4, SS to 2B"
                    : "Examples: 7 to 3, SS to 1B"
                }
              />
              <small>Required. Numbered notation such as 6 to 4 automatically selects the field location.</small>
            </label>
          ) : null}
          <label className="scorekeeper-note">Play note
            <textarea maxLength={250} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder={selectedResult === "Other" ? "Required for Other" : "Optional details about the play..."} />
            <small>{note.length} / 250</small>
          </label>
          <div className="save-play-row">
            <button className="ghost-button" onClick={onCancel}>Cancel</button>
            <button disabled={saveDisabled} onClick={onSave}>Save Play</button>
          </div>
        </div>
      </div>
    </section>
  );
}
