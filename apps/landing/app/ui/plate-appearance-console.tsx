"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { CurrentGameLineups } from "@ll-score/game-engine";
import type { PlateAppearanceState, PitchCall } from "@ll-score/count-controls";
import {
  describePitchLocation,
  type PitchLocation
} from "@ll-score/pitch-location";
import {
  describeHitLocation,
  type HitLocation
} from "@ll-score/hit-location";

interface Props {
  gameId: string;
  lineups: CurrentGameLineups;
  state: PlateAppearanceState;
  disabled: boolean;
  onRecorded: () => Promise<void>;
}

const pitchCalls: Array<{ value: PitchCall; label: string }> = [
  { value: "BALL", label: "Ball" },
  { value: "CALLED_STRIKE", label: "Called strike" },
  { value: "SWINGING_STRIKE", label: "Swinging strike" },
  { value: "FOUL", label: "Foul" },
  { value: "IN_PLAY", label: "In play" },
  { value: "HIT_BY_PITCH", label: "Hit by pitch" }
];

export function PlateAppearanceConsole({
  gameId,
  lineups,
  state,
  disabled,
  onRecorded
}: Props) {
  const batters =
    lineups.away.teamId === state.battingTeamId
      ? lineups.away.players
      : lineups.home.players;
  const fielders =
    lineups.home.teamId === state.fieldingTeamId
      ? lineups.home.players
      : lineups.away.players;
  const pitchers = useMemo(
    () => fielders,
    [fielders]
  );
  const [batterId, setBatterId] = useState(
    state.nextBatterId ?? batters[0]?.playerId ?? ""
  );
  const [pitcherId, setPitcherId] = useState(
    pitchers.find((player) => player.isCurrentPitcher)?.playerId ?? ""
  );
  const [pitchType, setPitchType] = useState("Fastball");
  const [location, setLocation] = useState<PitchLocation | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("Single");
  const [hitLocation, setHitLocation] = useState<HitLocation | null>(null);

  useEffect(() => {
    setBatterId(state.nextBatterId ?? batters[0]?.playerId ?? "");
  }, [state.nextBatterId, batters]);

  useEffect(() => {
    setPitcherId(
      fielders.find((player) => player.isCurrentPitcher)?.playerId ??
        fielders[0]?.playerId ??
        ""
    );
  }, [state.fieldingTeamId, fielders]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/games/${gameId}/plate-appearance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(await response.text());
    if (body.action === "PITCH") setLocation(null);
    if (body.action === "BALL_IN_PLAY") setHitLocation(null);
    await onRecorded();
  }

  async function start() {
    const batter = batters.find((player) => player.playerId === batterId);
    const pitcher = pitchers.find((player) => player.playerId === pitcherId);
    if (!batter || !pitcher) return;
    setLocation(null);
    await post({
      action: "START",
      batterId,
      batterLabel: batter.displayLabel,
      pitcherId,
      pitcherLabel: pitcher.displayLabel
    });
  }

  function chooseLocation(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setLocation(
      describePitchLocation(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height
      )
    );
  }

  function chooseHitLocation(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setHitLocation(
      describeHitLocation(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height
      )
    );
  }

  return (
    <section className="plate-console">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live scoring</p>
          <h2>Plate Appearance / Pitch Console</h2>
        </div>
        <div className="count-display">
          <span>B <strong>{state.balls}</strong></span>
          <span>S <strong>{state.strikes}</strong></span>
          <span>O <strong>{state.outs}</strong></span>
        </div>
      </div>
      <div className="pa-identity">
        <label>Batter
          <select value={batterId} disabled>
            {batters.map((player) => <option key={player.playerId} value={player.playerId}>{player.displayLabel}</option>)}
          </select>
        </label>
        <label>Pitcher
          <select value={pitcherId} onChange={(event) => setPitcherId(event.target.value)}>
            {pitchers.map((player) => <option key={player.playerId} value={player.playerId}>{player.displayLabel}</option>)}
          </select>
        </label>
        <button disabled={disabled} onClick={() => void start()}>Batter Up</button>
      </div>
      <div className="active-matchup">
        <strong>{state.active ? state.batterLabel : "No active batter"}</strong>
        <span>{state.active ? `facing ${state.pitcherLabel} - Pitch ${state.pitchNumber + 1}` : `${state.nextBatterLabel ?? "Next batter"} is due up`}</span>
      </div>
      <div className="pitch-details">
        <label>Pitch type
          <select value={pitchType} onChange={(event) => setPitchType(event.target.value)}>
            {["Fastball", "Changeup", "Curveball", "Slider", "Other"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Pitcher and batter action..." />
        </label>
      </div>
      <div className="pitch-entry">
        <div>
          <p className="pitch-step">1. Click where the pitch crossed the plate</p>
          <button type="button" className="strike-zone-control" aria-label="Pitch location" disabled={disabled || !state.active} onClick={chooseLocation}>
            <span className="strike-zone-grid" />
            {location ? <span className={`pitch-marker ${location.isInStrikeZone ? "in-zone" : ""}`} style={{ left: `${location.x * 100}%`, top: `${location.y * 100}%` }} /> : null}
          </button>
          <div className="location-readout">
            {location ? `${location.zone}${location.isInStrikeZone ? " (in zone)" : " (outside zone)"}` : "No pitch location selected"}
          </div>
        </div>
        <div>
          <p className="pitch-step">2. Record the result</p>
          <div className="pitch-actions">
            {pitchCalls.map((call) => (
              <button key={call.value} disabled={disabled || !state.active || !location} onClick={() => void post({
                action: "PITCH",
                call: call.value,
                pitchType,
                location: location?.zone,
                locationX: location?.x,
                locationY: location?.y,
                isInStrikeZone: location?.isInStrikeZone,
                description
              })}>{call.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="ball-in-play">
        <div>
          <p className="pitch-step">Hit location</p>
          <button type="button" className="hit-field-control" aria-label="Hit location" disabled={disabled || !state.active} onClick={chooseHitLocation}>
            <span className="hit-infield" />
            <span className="hit-home" />
            {hitLocation ? <span className="hit-marker" style={{ left: `${hitLocation.x * 100}%`, top: `${hitLocation.y * 100}%` }} /> : null}
          </button>
          <div className="location-readout">{hitLocation?.area ?? "Click where the ball was hit"}</div>
        </div>
        <div className="hit-result-controls">
          <p className="pitch-step">Hit result</p>
          <div className="hit-buttons">
            {["Single", "Double", "Triple", "Home run"].map((value) => (
              <button key={value} disabled={disabled || !state.active || !hitLocation} onClick={() => void post({
                action: "BALL_IN_PLAY",
                result: value,
                fieldLocation: hitLocation?.area,
                hitLocationX: hitLocation?.x,
                hitLocationY: hitLocation?.y,
                description
              })}>{value}</button>
            ))}
          </div>
          <label>Other play result
            <select value={result} onChange={(event) => setResult(event.target.value)}>
              {["Ground out", "Fly out", "Line out", "Error", "Fielders choice"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <button disabled={disabled || !state.active || !hitLocation} onClick={() => void post({
            action: "BALL_IN_PLAY",
            result,
            fieldLocation: hitLocation?.area,
            hitLocationX: hitLocation?.x,
            hitLocationY: hitLocation?.y,
            description
          })}>Record Other Play</button>
        </div>
      </div>
    </section>
  );
}
