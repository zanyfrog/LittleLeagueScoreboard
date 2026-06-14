"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CurrentGameLineups,
  GameReplay,
  GameSummary
} from "@ll-score/game-engine";
import type { GameEvent, PlayerPosition } from "@ll-score/contracts";
import type { ScoreboardView } from "@ll-score/scoreboard";
import {
  activeGameEvents,
  projectPlateAppearance,
  type PlateAppearanceState
} from "@ll-score/count-controls";
import { selectablePositions } from "@ll-score/rosters";
import { Field } from "./field";
import { Lineup } from "./lineup";
import { PlateAppearanceConsole } from "./plate-appearance-console";
import { RunnerOutControls } from "./runner-out-controls";
import { EventLogEditor } from "./event-log-editor";

interface GameData {
  game: GameSummary;
  lineups: CurrentGameLineups;
  replay: GameReplay;
  scoreboard: ScoreboardView;
  plateAppearance: PlateAppearanceState;
}

function startingLineupText(payload: Record<string, unknown>): string {
  const startingLineups = payload.startingLineups as
    | {
        away?: {
          teamName?: string;
          players?: Array<{
            battingOrder?: number;
            displayLabel?: string;
            position?: string;
          }>;
        };
        home?: {
          teamName?: string;
          players?: Array<{
            battingOrder?: number;
            displayLabel?: string;
            position?: string;
          }>;
        };
      }
    | undefined;
  if (!startingLineups) return "Play Ball";
  const formatTeam = (team?: typeof startingLineups.away) =>
    `${team?.teamName ?? "Team"}: ${(team?.players ?? [])
      .map(
        (player) =>
          `${player.battingOrder}. ${player.displayLabel} (${player.position})`
      )
      .join(", ")}`;
  return `Starting lineups | Away - ${formatTeam(startingLineups.away)} | Home - ${formatTeam(startingLineups.home)}`;
}

function eventTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

export function GameWorkspace({ gameId }: { gameId: string }) {
  const [data, setData] = useState<GameData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lineupSaveState, setLineupSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [showEventEditor, setShowEventEditor] = useState(false);
  const pitchCountsByEventId = useMemo(() => {
    const counts = new Map<string, { balls: number; strikes: number }>();
    const projectedEvents: GameEvent[] = [];
    for (const event of activeGameEvents(data?.replay.events ?? []).sort(
      (left, right) => left.eventOrder - right.eventOrder
    )) {
      projectedEvents.push(event);
      if (
        event.eventType === "FieldingActionRecorded" &&
        event.payload.countsTowardPitch === true
      ) {
        const state = projectPlateAppearance(projectedEvents);
        counts.set(event.eventId, {
          balls: state.balls,
          strikes: state.strikes
        });
      }
    }
    return counts;
  }, [data?.replay.events]);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    setData(await response.json());
  }, [gameId]);

  useEffect(() => {
    setData(null);
    load().catch((reason) => setError(String(reason)));
  }, [load]);

  async function changePosition(
    teamId: string,
    playerId: string,
    toPosition: PlayerPosition
  ) {
    setBusy(true);
    try {
      await fetch(`/api/games/${gameId}/positions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, playerId, toPosition })
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveRunner(
    runnerId: string,
    from: string,
    to: string,
    outcome: "SAFE" | "OUT" = "SAFE",
    reason = "manual scorer entry"
  ) {
    setBusy(true);
    try {
      await fetch(`/api/games/${gameId}/runners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runnerId, from, to, outcome, reason })
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function recordRunnerOut(
    runnerId: string,
    from: string,
    outType: "PICKOFF" | "THROW_OUT" | "CAUGHT_STEALING",
    fieldingSequence = "",
    attemptedBase?: "SECOND" | "THIRD" | "HOME"
  ) {
    setBusy(true);
    try {
      const response = await fetch(`/api/games/${gameId}/runners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runnerId,
          from,
          to: "OUT",
          outcome: "OUT",
          outType,
          fieldingSequence,
          attemptedBase,
          completesPlateAppearance: false
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reorderLineup(teamId: string, playerIds: string[]) {
    setBusy(true);
    setLineupSaveState("saving");
    try {
      const response = await fetch(`/api/games/${gameId}/lineup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, playerIds })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
      setLineupSaveState("saved");
    } catch (reason) {
      setLineupSaveState("failed");
      setError(String(reason));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changeHandedness(
    playerId: string,
    bats: "LEFT" | "RIGHT" | "SWITCH",
    throws: "LEFT" | "RIGHT"
  ) {
    setBusy(true);
    try {
      const response = await fetch(`/api/players/${playerId}/handedness`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bats, throws })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function playBall() {
    setBusy(true);
    try {
      const response = await fetch(`/api/games/${gameId}/play-ball`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function adjustOuts(outs: number) {
    setBusy(true);
    try {
      const response = await fetch(`/api/games/${gameId}/outs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outs,
          reason: "manual scoreboard adjustment"
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) return <section className="error">{error}</section>;
  if (!data) return <section className="loading">Loading game workspace...</section>;

  const { scoreboard, lineups, replay } = data;
  const allPlayers = [...lineups.away.players, ...lineups.home.players];
  const gameStarted = replay.events.some(
    (event) => event.eventType === "GameStarted"
  );
  const isFinal = data.game.status === "FINAL";
  const lineupSaveMessage =
    lineupSaveState === "saving"
      ? "Saving lineup..."
      : lineupSaveState === "saved"
        ? "Lineup saved for this game"
        : lineupSaveState === "failed"
          ? "Lineup was not saved"
          : "Lineup changes are saved automatically to this game";
  const inningCount = Math.max(
    6,
    scoreboard.inning,
    scoreboard.awayInningScores.length,
    scoreboard.homeInningScores.length
  );
  const innings = Array.from({ length: inningCount }, (_, index) => index + 1);
  const activeEventIds = new Set(
    activeGameEvents(replay.events).map((event) => event.eventId)
  );

  return (
    <>
      <section className="scoreboard">
        <div
          className="scoreboard-grid"
          style={{
            gridTemplateColumns: `minmax(190px, 1.6fr) repeat(${inningCount}, minmax(42px, .45fr)) minmax(56px, .55fr)`
          }}
        >
          <div className="scoreboard-cell team-heading">Team</div>
          {innings.map((inning) => (
            <div className="scoreboard-cell inning-heading" key={`heading-${inning}`}>
              {inning}
            </div>
          ))}
          <div className="scoreboard-cell total-heading">R</div>

          <div className="scoreboard-cell team-name">
            <span>Away</span>
            <strong>{scoreboard.awayTeam}</strong>
          </div>
          {innings.map((inning) => (
            <div className="scoreboard-cell inning-run" key={`away-${inning}`}>
              {scoreboard.awayInningScores[inning - 1] ?? ""}
            </div>
          ))}
          <div className="scoreboard-cell total-run">{scoreboard.awayScore}</div>

          <div className="scoreboard-cell team-name">
            <span>Home</span>
            <strong>{scoreboard.homeTeam}</strong>
          </div>
          {innings.map((inning) => (
            <div className="scoreboard-cell inning-run" key={`home-${inning}`}>
              {scoreboard.homeInningScores[inning - 1] ?? ""}
            </div>
          ))}
          <div className="scoreboard-cell total-run">{scoreboard.homeScore}</div>
        </div>
        <div className="scoreboard-at-bat">
          <div>
            <span>At bat</span>
            <strong>
              {data.plateAppearance.active
                ? data.plateAppearance.batterLabel ?? "Not selected"
                : data.plateAppearance.nextBatterLabel ?? "Not started"}
            </strong>
          </div>
          <div><span>Pitcher</span><strong>{data.plateAppearance.pitcherLabel ?? "Not selected"}</strong></div>
          <div><span>Inning</span><strong>{scoreboard.half === "TOP" ? "Top" : "Bottom"} {scoreboard.inning}</strong></div>
          <div><span>Count</span><strong>{scoreboard.balls} - {scoreboard.strikes}</strong></div>
          <div className="scoreboard-outs">
            <span>Outs</span>
            <div>
              <button
                aria-label="Decrease outs"
                disabled={busy || !gameStarted || isFinal || scoreboard.outs <= 0}
                onClick={() => void adjustOuts(scoreboard.outs - 1)}
              >
                -
              </button>
              <strong>{scoreboard.outs}</strong>
              <button
                aria-label="Increase outs"
                disabled={busy || !gameStarted || isFinal}
                onClick={() => void adjustOuts(scoreboard.outs + 1)}
              >
                +
              </button>
            </div>
          </div>
          <div><span>Status</span><strong>{scoreboard.status.replace("_", " ")}</strong></div>
        </div>
      </section>

      {!gameStarted && !isFinal ? (
        <section className="pregame-lineups">
          <div className="pregame-message">
            <p className="eyebrow">Set the batting order</p>
            <h2>Drag players into position</h2>
            <p>Review both lineups and defensive positions. Scoring controls stay hidden until the game begins.</p>
          </div>
          <div className="pregame-lineup-grid">
            <Lineup lineup={lineups.away} positions={selectablePositions} disabled={busy} draggable onChange={changePosition} onReorder={reorderLineup} onHandednessChange={changeHandedness} />
            <Lineup lineup={lineups.home} positions={selectablePositions} disabled={busy} draggable onChange={changePosition} onReorder={reorderLineup} onHandednessChange={changeHandedness} />
          </div>
          <p className={`lineup-save-state ${lineupSaveState}`}>
            {lineupSaveMessage}
          </p>
          <button className="play-ball-button" disabled={busy} onClick={() => void playBall()}>Play Ball</button>
        </section>
      ) : !isFinal ? (
        <PlateAppearanceConsole
          gameId={gameId}
          lineups={lineups}
          events={replay.events}
          baseState={replay.currentBaseState}
          state={data.plateAppearance}
          disabled={busy}
          onSteal={(runnerId, from, to) =>
            void moveRunner(runnerId, from, to, "SAFE", "stolen base")
          }
          onCaughtStealing={(runnerId, from, attemptedBase) =>
            void recordRunnerOut(
              runnerId,
              from,
              "CAUGHT_STEALING",
              "",
              attemptedBase
            )
          }
          onRecorded={load}
        />
      ) : (
        <section className="completed-game-banner">
          <p className="eyebrow">Completed game</p>
          <h2>Saved lineup and game review</h2>
          <p>This game is read-only. Its game-specific lineup and replay remain available below.</p>
        </section>
      )}

      {gameStarted || isFinal ? <section className="workspace-grid">
        <Lineup lineup={lineups.away} positions={selectablePositions} disabled={busy || isFinal} draggable={!isFinal} onChange={changePosition} onReorder={reorderLineup} onHandednessChange={changeHandedness} />
        <div className="center-stack">
          {!isFinal ? (
            <p className={`lineup-save-state ${lineupSaveState}`}>
              {lineupSaveMessage}
            </p>
          ) : null}
          <Field alignments={replay.currentAlignments} />
          <div className="control-row">
            <RunnerOutControls
              state={replay.currentBaseState}
              disabled={busy || isFinal}
              onRecord={recordRunnerOut}
            />
            <div className="runner-controls">
              <h3>Runner Entry</h3>
              <select id="runner-player" defaultValue={allPlayers[0]?.playerId} disabled={isFinal}>
                {allPlayers.map((player) => <option key={player.playerId} value={player.playerId}>{player.displayLabel}</option>)}
              </select>
              <button disabled={busy || isFinal} onClick={() => {
                const id = (document.getElementById("runner-player") as HTMLSelectElement).value;
                void moveRunner(id, "BATTER", "FIRST");
              }}>Safe at first</button>
              <button disabled={busy || isFinal} onClick={() => {
                const id = (document.getElementById("runner-player") as HTMLSelectElement).value;
                void moveRunner(id, "BATTER", "OUT", "OUT");
              }}>Runner out</button>
            </div>
          </div>
        </div>
        <Lineup lineup={lineups.home} positions={selectablePositions} disabled={busy || isFinal} draggable={!isFinal} onChange={changePosition} onReorder={reorderLineup} onHandednessChange={changeHandedness} />
      </section> : null}

      <section className="timeline">
        <div className="section-heading">
          <div><p className="eyebrow">Replay</p><h2>Event timeline</h2></div>
          <div className="timeline-heading-actions">
            <span>{replay.eventVersion} recorded events | Game ID: <code>{gameId}</code></span>
            <button
              className="edit-team-button"
              onClick={() => setShowEventEditor((value) => !value)}
            >
              {showEventEditor ? "Close Event Editor" : "Manage Event Log"}
            </button>
          </div>
        </div>
        {showEventEditor ? (
          <EventLogEditor
            gameId={gameId}
            events={replay.events}
            disabled={busy}
            onRecorded={load}
          />
        ) : null}
        {replay.events.length === 0 ? (
          <p className="empty">No events yet. Change a position or record a runner to begin replay.</p>
        ) : (
          <ol>
            {[...replay.events].reverse().map((event) => (
              <li key={event.eventId}>
                <strong>
                  {event.eventType === "FieldingActionRecorded"
                    ? "Pitch Result Recorded"
                    : event.eventType.replace(/([A-Z])/g, " $1").trim()}
                  {!activeEventIds.has(event.eventId) &&
                  event.eventType !== "EventReversed"
                    ? " (Superseded)"
                    : ""}
                </strong>
                <span title={event.eventTimeUtc}>
                  Event {event.eventOrder} | {eventTimestamp(event.eventTimeUtc)}
                </span>
                <small>
                  {event.positionChanges.map((change) => `${change.displayLabel}: ${change.fromPosition} to ${change.toPosition}`).join(", ")}
                  {event.runnerMovements.map((move) => `${move.runnerId}: ${move.from} to ${move.to}`).join(", ")}
                  {event.eventType === "GameStarted" ? startingLineupText(event.payload) : ""}
                  {event.eventType === "PlateAppearanceStarted" ? `${String(event.payload.batterLabel)} facing ${String(event.payload.pitcherLabel)}` : ""}
                  {event.eventType === "PitchRecorded" ? `${String(event.payload.pitchType)} at ${String(event.payload.location)} (${Math.round(Number(event.payload.locationX) * 100)}%, ${Math.round(Number(event.payload.locationY) * 100)}%)${event.payload.call ? `: ${String(event.payload.call).replaceAll("_", " ").toLowerCase()}` : " - awaiting official result"}${event.payload.description ? ` - ${String(event.payload.description)}` : ""}` : ""}
                  {event.eventType === "ScorekeeperCommentRecorded" ? String(event.payload.comment ?? "") : ""}
                  {event.eventType === "OutCountAdjusted"
                    ? `Outs changed from ${String(event.payload.previousOuts ?? "?")} to ${String(event.payload.outs ?? "?")}${event.payload.reason ? ` - ${String(event.payload.reason)}` : ""}`
                    : ""}
                  {event.eventType === "FieldingActionRecorded"
                    ? `Pitch result: ${String(event.payload.result).replaceAll("_", " ").toLowerCase()}${
                        pitchCountsByEventId.has(event.eventId)
                          ? ` | Count after pitch: ${pitchCountsByEventId.get(event.eventId)!.balls}-${pitchCountsByEventId.get(event.eventId)!.strikes}`
                          : ""
                      }${event.payload.description ? ` - ${String(event.payload.description)}` : ""}`
                    : ""}
                  {event.eventType === "EventReversed" ? `Undid ${String(event.payload.reversedEventType ?? "event")} ${event.reversesEventId ? `(event ${event.reversesEventId})` : ""}` : ""}
                  {event.eventType === "BallPutInPlay" ? `${String(event.payload.result)} to ${String(event.payload.fieldLocation)}${event.payload.fieldingSequence ? ` (${String(event.payload.fieldingSequence)})` : ""}${event.payload.description ? ` - ${String(event.payload.description)}` : ""}` : ""}
                  {event.eventType === "RunnerOut" && event.payload.outType
                    ? event.payload.outType === "CAUGHT_STEALING"
                      ? `caught stealing ${String(event.payload.attemptedBase ?? "").toLowerCase()}`
                      : `${String(event.payload.outType).replaceAll("_", " ").toLowerCase()}: ${String(event.payload.fieldingSequence ?? "")}`
                    : ""}
                </small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
