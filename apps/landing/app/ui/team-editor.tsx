"use client";

import { useEffect, useState } from "react";
import type { PlayerPosition, Team } from "@ll-score/contracts";
import { selectablePositions } from "@ll-score/rosters";

interface EditablePlayer {
  playerId: string;
  displayName: string;
  jerseyNumber: string;
  primaryPosition: PlayerPosition;
  bats: "LEFT" | "RIGHT" | "SWITCH";
  throws: "LEFT" | "RIGHT";
}

export function TeamEditor({
  teams,
  initialTeamId,
  onSaved,
  onClose
}: {
  teams: Team[];
  initialTeamId: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [teamId, setTeamId] = useState(initialTeamId || teams[0]?.teamId || "");
  const [teamName, setTeamName] = useState("");
  const [roster, setRoster] = useState<EditablePlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!teamId) return;
    setBusy(true);
    setMessage("");
    fetch(`/api/setup/teams/${teamId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then((data) => {
        setTeamName(data.team.name);
        setRoster(data.roster);
      })
      .catch((reason) => setMessage(String(reason)))
      .finally(() => setBusy(false));
  }, [teamId]);

  function updatePlayer(
    playerId: string,
    changes: Partial<EditablePlayer>
  ) {
    setRoster((players) =>
      players.map((player) =>
        player.playerId === playerId ? { ...player, ...changes } : player
      )
    );
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/setup/teams/${teamId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: teamName, roster })
      });
      if (!response.ok) throw new Error(await response.text());
      await onSaved();
      setMessage("Team and roster saved.");
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="team-editor">
      <div className="team-editor-heading">
        <div>
          <p className="eyebrow">Team administration</p>
          <h2>Edit Team & Roster</h2>
        </div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>
      <div className="team-editor-controls">
        <label>Team to edit
          <select
            value={teamId}
            disabled={busy}
            onChange={(event) => setTeamId(event.target.value)}
          >
            {teams.map((team) => (
              <option key={team.teamId} value={team.teamId}>{team.name}</option>
            ))}
          </select>
        </label>
        <label>Team name
          <input
            value={teamName}
            disabled={busy}
            onChange={(event) => setTeamName(event.target.value)}
          />
        </label>
      </div>
      <div className="roster-editor">
        <div className="roster-editor-header">
          <span>#</span><span>Player name</span><span>Position</span>
          <span>Bats</span><span>Throws</span>
        </div>
        {roster.map((player) => (
          <div className="roster-editor-row" key={player.playerId}>
            <input
              aria-label={`${player.displayName} jersey number`}
              value={player.jerseyNumber}
              disabled={busy}
              maxLength={3}
              onChange={(event) =>
                updatePlayer(player.playerId, {
                  jerseyNumber: event.target.value
                })
              }
            />
            <input
              aria-label={`${player.displayName} name`}
              value={player.displayName}
              disabled={busy}
              maxLength={80}
              onChange={(event) =>
                updatePlayer(player.playerId, {
                  displayName: event.target.value
                })
              }
            />
            <select
              aria-label={`${player.displayName} position`}
              value={player.primaryPosition}
              disabled={busy}
              onChange={(event) =>
                updatePlayer(player.playerId, {
                  primaryPosition: event.target.value as PlayerPosition
                })
              }
            >
              {selectablePositions.map((position) => (
                <option key={position}>{position}</option>
              ))}
            </select>
            <select
              aria-label={`${player.displayName} batting stance`}
              value={player.bats}
              disabled={busy}
              onChange={(event) =>
                updatePlayer(player.playerId, {
                  bats: event.target.value as EditablePlayer["bats"]
                })
              }
            >
              <option value="RIGHT">R</option>
              <option value="LEFT">L</option>
              <option value="SWITCH">S</option>
            </select>
            <select
              aria-label={`${player.displayName} throwing arm`}
              value={player.throws}
              disabled={busy}
              onChange={(event) =>
                updatePlayer(player.playerId, {
                  throws: event.target.value as EditablePlayer["throws"]
                })
              }
            >
              <option value="RIGHT">R</option>
              <option value="LEFT">L</option>
            </select>
          </div>
        ))}
      </div>
      <div className="team-editor-actions">
        <span>{message}</span>
        <button
          disabled={
            busy ||
            !teamName.trim() ||
            roster.some(
              (player) =>
                !player.displayName.trim() || !player.jerseyNumber.trim()
            )
          }
          onClick={() => void save()}
        >
          Save Team
        </button>
      </div>
    </section>
  );
}
