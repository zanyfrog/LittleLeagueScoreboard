"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurrentGameLineups } from "@ll-score/game-engine";
import type { BaseState, GameEvent } from "@ll-score/contracts";
import {
  activeGameEvents,
  type PlateAppearanceState,
  type PitchCall
} from "@ll-score/count-controls";
import {
  InPlayView,
  inferLandingZoneFromFieldingSequence,
  type InPlayResult,
  type LandingZone
} from "./in-play-view";
import {
  PitchUmpireView,
  type PitchEntry
} from "./pitch-umpire-view";
import { Bases } from "./bases";

interface Props {
  gameId: string;
  lineups: CurrentGameLineups;
  events: GameEvent[];
  baseState: BaseState;
  state: PlateAppearanceState;
  disabled: boolean;
  onSteal: (
    runnerId: string,
    from: "FIRST" | "SECOND" | "THIRD",
    to: "SECOND" | "THIRD" | "HOME"
  ) => void;
  onCaughtStealing: (
    runnerId: string,
    from: "FIRST" | "SECOND" | "THIRD",
    attemptedBase: "SECOND" | "THIRD" | "HOME"
  ) => void;
  onRecorded: () => Promise<void>;
}

function zoneCoordinates(zone: number): { x: number; y: number } {
  const coordinates: Record<number, { x: number; y: number }> = {
    7: { x: 0.15, y: 0.12 }, 8: { x: 0.5, y: 0.12 }, 9: { x: 0.85, y: 0.12 },
    4: { x: 0.15, y: 0.5 }, 5: { x: 0.5, y: 0.5 }, 6: { x: 0.85, y: 0.5 },
    1: { x: 0.15, y: 0.88 }, 2: { x: 0.5, y: 0.88 }, 3: { x: 0.85, y: 0.88 }
  };
  return coordinates[zone] ?? coordinates[5]!;
}

export function PlateAppearanceConsole({
  gameId,
  lineups,
  events,
  baseState,
  state,
  disabled,
  onSteal,
  onCaughtStealing,
  onRecorded
}: Props) {
  const batters = lineups.away.teamId === state.battingTeamId
    ? lineups.away.players : lineups.home.players;
  const fielders = lineups.home.teamId === state.fieldingTeamId
    ? lineups.home.players : lineups.away.players;
  const pitchers = useMemo(() => fielders, [fielders]);
  const [batterId, setBatterId] = useState(state.nextBatterId ?? "");
  const [pitcherId, setPitcherId] = useState(
    pitchers.find((player) => player.isCurrentPitcher)?.playerId ?? ""
  );
  const [view, setView] = useState<"pitch" | "in-play">("pitch");
  const [pitchZone, setPitchZone] = useState<number | null>(null);
  const [pitchNote, setPitchNote] = useState("");
  const [landingZone, setLandingZone] = useState<LandingZone | null>(null);
  const [playResult, setPlayResult] = useState<InPlayResult | null>(null);
  const [fieldingSequence, setFieldingSequence] = useState("");
  const [playNote, setPlayNote] = useState("");

  useEffect(() => {
    setBatterId(state.nextBatterId ?? "");
  }, [state.nextBatterId, state.active]);

  useEffect(() => {
    setPitcherId(
      fielders.find((player) => player.isCurrentPitcher)?.playerId ??
        fielders[0]?.playerId ?? ""
    );
  }, [state.fieldingTeamId, fielders]);

  const pitchSequence = useMemo(() => {
    const active = activeGameEvents(events).sort(
      (left, right) => left.eventOrder - right.eventOrder
    );
    const plateAppearanceStart = [...active]
      .reverse()
      .find((event) => event.eventType === "PlateAppearanceStarted");
    if (!plateAppearanceStart) return [];
    const resultsByAction = new Map(
      active
        .filter(
          (event) =>
            event.eventType === "FieldingActionRecorded" &&
            event.payload.countsTowardPitch === true
        )
        .map((event) => [
          String(event.payload.actionId ?? ""),
          event.payload.result as PitchCall
        ])
    );
    return active
      .filter(
        (event) =>
          event.eventOrder > plateAppearanceStart.eventOrder &&
          event.eventType === "PitchRecorded" &&
          event.payload.source === "location"
      )
      .map((event): PitchEntry => ({
        call:
          (event.payload.call as PitchCall | undefined) ??
          resultsByAction.get(String(event.payload.actionId ?? "")),
        zone: Number(event.payload.locationZone),
        note: String(event.payload.description ?? "")
      }))
      .filter((pitch) => Number.isFinite(pitch.zone));
  }, [events]);
  const pendingPitch = [...pitchSequence].reverse().find((pitch) => !pitch.call);
  const pendingPitchActionId = useMemo(() => {
    if (!pendingPitch) return undefined;
    const active = activeGameEvents(events).sort(
      (left, right) => left.eventOrder - right.eventOrder
    );
    const results = new Set(
      active
        .filter(
          (event) =>
            event.eventType === "FieldingActionRecorded" &&
            event.payload.countsTowardPitch === true
        )
        .map((event) => String(event.payload.actionId ?? ""))
    );
    return [...active]
      .reverse()
      .find(
        (event) =>
          event.eventType === "PitchRecorded" &&
          event.payload.source === "location" &&
          !event.payload.call &&
          !results.has(String(event.payload.actionId ?? ""))
      )?.payload.actionId as string | undefined;
  }, [events, pendingPitch]);

  useEffect(() => {
    setPitchZone(pendingPitch?.zone ?? null);
  }, [pendingPitch?.zone]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/games/${gameId}/plate-appearance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(await response.text());
    await onRecorded();
  }

  async function start() {
    const batter = batters.find((player) => player.playerId === batterId);
    const pitcher = pitchers.find((player) => player.playerId === pitcherId);
    if (!batter || !pitcher) return;
    await post({
      action: "START",
      batterId,
      batterLabel: batter.displayLabel,
      pitcherId,
      pitcherLabel: pitcher.displayLabel
    });
  }

  async function recordLocation(zone: number) {
    const coordinates = zoneCoordinates(zone);
    await post({
      action: "LOCATION",
      pitchActionId: pendingPitchActionId,
      pitchType: "Unspecified",
      location: `Zone ${zone}`,
      locationZone: zone,
      locationX: coordinates.x,
      locationY: coordinates.y,
      isInStrikeZone: zone === 5
    });
  }

  async function recordResult(call: PitchCall) {
    await post({
      action: "RESULT",
      result: call,
      pitchActionId: pendingPitchActionId
    });
    setPitchZone(null);
    if (call === "IN_PLAY") setView("in-play");
  }

  async function endHalfInning() {
    const response = await fetch(`/api/games/${gameId}/half-inning`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "mercy rule" })
    });
    if (!response.ok) throw new Error(await response.text());
    setPitchZone(null);
    setView("pitch");
    await onRecorded();
  }

  async function undoLastAction() {
    const response = await fetch(`/api/games/${gameId}/undo`, {
      method: "POST"
    });
    if (!response.ok) throw new Error(await response.text());
    setPitchZone(null);
    setView("pitch");
    await onRecorded();
  }

  async function submitComment() {
    const comment = pitchNote.trim();
    if (!comment) return;
    const response = await fetch(`/api/games/${gameId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comment })
    });
    if (!response.ok) throw new Error(await response.text());
    setPitchNote("");
    await onRecorded();
  }

  async function savePlay() {
    if (!playResult) return;
    const resolvedLandingZone =
      landingZone ??
      (playResult === "Ground Out" || playResult === "Fielders choice"
        ? inferLandingZoneFromFieldingSequence(fieldingSequence)
        : null);
    if (!resolvedLandingZone) return;
    await post({
      action: "BALL_IN_PLAY",
      result: playResult,
      fieldLocation: resolvedLandingZone,
      landingZone: resolvedLandingZone,
      fieldingSequence:
        playResult === "Ground Out" || playResult === "Fielders choice"
          ? fieldingSequence.trim()
          : undefined,
      description: playNote
    });
    setLandingZone(null);
    setPlayResult(null);
    setFieldingSequence("");
    setPlayNote("");
    setView("pitch");
  }

  const batter = batters.find((player) => player.playerId === batterId);
  const pitcher = pitchers.find((player) => player.playerId === pitcherId);

  return (
    <section className="plate-console">
      <div className="section-heading">
        <div><p className="eyebrow">Live scoring</p><h2>At-Bat Scorekeeper</h2></div>
        <div className="scorekeeper-header-actions">
          <div className="count-display">
            <span>B <strong>{state.balls}</strong></span>
            <span>S <strong>{state.strikes}</strong></span>
            <span>O <strong>{state.outs}</strong></span>
          </div>
        </div>
      </div>
      {view === "in-play" ? (
        <>
          <div className="scorekeeper-tabs">
            <button onClick={() => setView("pitch")}>Pitch / Umpire</button>
            <button className="active">In-Play</button>
          </div>
          <InPlayView
            selectedZone={landingZone}
            selectedResult={playResult}
            fieldingSequence={fieldingSequence}
            note={playNote}
            disabled={disabled}
            onZoneChange={setLandingZone}
            onResultChange={(result) => {
              setPlayResult(result);
              if (result !== "Ground Out" && result !== "Fielders choice") {
                setFieldingSequence("");
              }
            }}
            onFieldingSequenceChange={setFieldingSequence}
            onNoteChange={setPlayNote}
            onCancel={() => setView("pitch")}
            onSave={() => void savePlay()}
          />
        </>
      ) : !state.active ? (
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
          <div className="between-batter-actions">
            <button disabled={disabled} onClick={() => void start()}>
              Batter Up{state.nextBatterLabel ? `: ${state.nextBatterLabel}` : ""}
            </button>
            <button className="undo-button" disabled={disabled} onClick={() => void undoLastAction()}>
              Undo Last Action
            </button>
            <button
              className="end-half-inning-button"
              disabled={disabled}
              title="Switch sides without recording another out"
              onClick={() => void endHalfInning()}
            >
              End Half-Inning (Mercy Rule)
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="scorekeeper-tabs">
            <button className="active">Pitch / Umpire</button>
            <button onClick={() => setView("in-play")}>In-Play</button>
          </div>
          <PitchUmpireView
            state={state}
            pitcherLabel={pitcher?.displayLabel ?? state.pitcherLabel}
            batterHandedness={`${batter?.bats?.slice(0, 1) ?? "R"} / ${batter?.throws?.slice(0, 1) ?? "R"}`}
            selectedZone={pitchZone}
            note={pitchNote}
            disabled={disabled}
            recentPitches={pitchSequence}
            onBasePanel={
              <Bases
                state={baseState}
                disabled={disabled}
                onSteal={onSteal}
                onCaughtStealing={onCaughtStealing}
              />
            }
            onZoneChange={setPitchZone}
            onRecordLocation={(zone) => void recordLocation(zone)}
            onNoteChange={setPitchNote}
            onSubmitComment={() => void submitComment()}
            onRecordResult={(call) => void recordResult(call)}
            onUndo={() => void undoLastAction()}
          />
        </>
      )}
    </section>
  );
}
