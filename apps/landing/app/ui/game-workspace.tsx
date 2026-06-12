"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CurrentGameLineups,
  GameReplay,
  GameSummary
} from "@ll-score/game-engine";
import type { PlayerPosition } from "@ll-score/contracts";
import type { ScoreboardView } from "@ll-score/scoreboard";
import type { PlateAppearanceState } from "@ll-score/count-controls";
import { selectablePositions } from "@ll-score/rosters";
import { Bases } from "./bases";
import { Field } from "./field";
import { Lineup } from "./lineup";
import { PlateAppearanceConsole } from "./plate-appearance-console";

interface GameData {
  game: GameSummary;
  lineups: CurrentGameLineups;
  replay: GameReplay;
  scoreboard: ScoreboardView;
  plateAppearance: PlateAppearanceState;
}

export function GameWorkspace({ gameId }: { gameId: string }) {
  const [data, setData] = useState<GameData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function reorderLineup(teamId: string, playerIds: string[]) {
    setBusy(true);
    try {
      const response = await fetch(`/api/games/${gameId}/lineup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, playerIds })
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

  if (error) return <section className="error">{error}</section>;
  if (!data) return <section className="loading">Loading game workspace...</section>;

  const { scoreboard, lineups, replay } = data;
  const allPlayers = [...lineups.away.players, ...lineups.home.players];
  const gameStarted = replay.events.some(
    (event) => event.eventType === "GameStarted"
  );

  return (
    <>
      <section className="scoreboard">
        <div className="team away"><span>Away</span><h2>{scoreboard.awayTeam}</h2></div>
        <div className="score">{scoreboard.awayScore}</div>
        <div className="inning"><span>{scoreboard.half}</span><strong>{scoreboard.inning}</strong><small>{scoreboard.status.replace("_", " ")}</small></div>
        <div className="score">{scoreboard.homeScore}</div>
        <div className="team home"><span>Home</span><h2>{scoreboard.homeTeam}</h2></div>
      </section>

      {!gameStarted ? (
        <section className="pregame-lineups">
          <div className="pregame-message">
            <p className="eyebrow">Set the batting order</p>
            <h2>Drag players into position</h2>
            <p>Review both lineups and defensive positions. Scoring controls stay hidden until the game begins.</p>
          </div>
          <div className="pregame-lineup-grid">
            <Lineup lineup={lineups.away} positions={selectablePositions} disabled={busy} draggable onChange={changePosition} onReorder={reorderLineup} />
            <Lineup lineup={lineups.home} positions={selectablePositions} disabled={busy} draggable onChange={changePosition} onReorder={reorderLineup} />
          </div>
          <button className="play-ball-button" disabled={busy} onClick={() => void playBall()}>Play Ball</button>
        </section>
      ) : (
        <PlateAppearanceConsole gameId={gameId} lineups={lineups} state={data.plateAppearance} disabled={busy} onRecorded={load} />
      )}

      {gameStarted ? <section className="workspace-grid">
        <Lineup lineup={lineups.away} positions={selectablePositions} disabled={busy} draggable={false} onChange={changePosition} onReorder={reorderLineup} />
        <div className="center-stack">
          <Field alignments={replay.currentAlignments} />
          <div className="control-row">
            <Bases
              state={replay.currentBaseState}
              disabled={busy}
              onSteal={(runnerId, from, to) => void moveRunner(runnerId, from, to, "SAFE", "stolen base")}
            />
            <div className="runner-controls">
              <h3>Runner Entry</h3>
              <select id="runner-player" defaultValue={allPlayers[0]?.playerId}>
                {allPlayers.map((player) => <option key={player.playerId} value={player.playerId}>{player.displayLabel}</option>)}
              </select>
              <button disabled={busy} onClick={() => {
                const id = (document.getElementById("runner-player") as HTMLSelectElement).value;
                void moveRunner(id, "BATTER", "FIRST");
              }}>Safe at first</button>
              <button disabled={busy} onClick={() => {
                const id = (document.getElementById("runner-player") as HTMLSelectElement).value;
                void moveRunner(id, "BATTER", "OUT", "OUT");
              }}>Runner out</button>
            </div>
          </div>
        </div>
        <Lineup lineup={lineups.home} positions={selectablePositions} disabled={busy} draggable={false} onChange={changePosition} onReorder={reorderLineup} />
      </section> : null}

      <section className="timeline">
        <div className="section-heading">
          <div><p className="eyebrow">Replay</p><h2>Event timeline</h2></div>
          <span>{replay.eventVersion} recorded events</span>
        </div>
        {replay.events.length === 0 ? (
          <p className="empty">No events yet. Change a position or record a runner to begin replay.</p>
        ) : (
          <ol>
            {[...replay.events].reverse().map((event) => (
              <li key={event.eventId}>
                <strong>{event.eventType.replace(/([A-Z])/g, " $1").trim()}</strong>
                <span>Event {event.eventOrder}</span>
                <small>
                  {event.positionChanges.map((change) => `${change.displayLabel}: ${change.fromPosition} to ${change.toPosition}`).join(", ")}
                  {event.runnerMovements.map((move) => `${move.runnerId}: ${move.from} to ${move.to}`).join(", ")}
                  {event.eventType === "PlateAppearanceStarted" ? `${String(event.payload.batterLabel)} facing ${String(event.payload.pitcherLabel)}` : ""}
                  {event.eventType === "PitchRecorded" ? `${String(event.payload.pitchType)} at ${String(event.payload.location)} (${Math.round(Number(event.payload.locationX) * 100)}%, ${Math.round(Number(event.payload.locationY) * 100)}%): ${String(event.payload.call).replaceAll("_", " ").toLowerCase()}${event.payload.description ? ` - ${String(event.payload.description)}` : ""}` : ""}
                  {event.eventType === "BallPutInPlay" ? `${String(event.payload.result)} to ${String(event.payload.fieldLocation)}${event.payload.description ? ` - ${String(event.payload.description)}` : ""}` : ""}
                </small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
