"use client";

import { useEffect, useState } from "react";
import type { GameLineup, LineupPlayer } from "@ll-score/game-engine";
import type { PlayerPosition } from "@ll-score/contracts";

export function Lineup({
  lineup, positions, disabled, draggable, onChange, onReorder
}: {
  lineup: GameLineup;
  positions: PlayerPosition[];
  disabled: boolean;
  draggable: boolean;
  onChange: (teamId: string, playerId: string, position: PlayerPosition) => void;
  onReorder: (teamId: string, playerIds: string[]) => void;
}) {
  const [players, setPlayers] = useState(lineup.players);
  const [draggedId, setDraggedId] = useState("");
  useEffect(() => setPlayers(lineup.players), [lineup.players]);

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...players];
    const from = next.findIndex((player) => player.playerId === draggedId);
    const to = next.findIndex((player) => player.playerId === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as LineupPlayer);
    setPlayers(next);
    setDraggedId("");
    onReorder(lineup.teamId, next.map((player) => player.playerId));
  }

  return (
    <aside className="lineup-card">
      <div className="lineup-title"><span>{draggable ? "Drag to set batting order" : "Lineup"}</span><h2>{lineup.teamName}</h2></div>
      <div className="lineup-list">
        {players.map((player, index) => (
          <div
            className={`player-row ${player.isCurrentPitcher ? "pitcher" : ""} ${draggable ? "draggable" : ""}`}
            key={player.playerId}
            draggable={draggable && !disabled}
            onDragStart={() => setDraggedId(player.playerId)}
            onDragOver={(event) => { if (draggable) event.preventDefault(); }}
            onDrop={() => dropOn(player.playerId)}
          >
            <span className="order">{draggable ? "::" : index + 1}</span>
            <strong><small>{index + 1}.</small> {player.displayLabel}</strong>
            <select aria-label={`${player.displayLabel} position`} value={player.position} disabled={disabled} onChange={(event) => onChange(lineup.teamId, player.playerId, event.target.value as PlayerPosition)}>
              {positions.map((position) => <option key={position}>{position}</option>)}
            </select>
          </div>
        ))}
      </div>
    </aside>
  );
}
