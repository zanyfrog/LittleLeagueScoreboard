"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameSummary } from "@ll-score/game-engine";
import type { Team } from "@ll-score/contracts";
import { GameWorkspace } from "./game-workspace";
import { TeamEditor } from "./team-editor";

const activeGameStorageKey = "ll-score-active-game-id";

function defaultMatchupTime(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function localDateTimeValue(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatMatchupTime(value?: string): string {
  if (!value) return "Date and time not set";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function navigationUrl(location: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
}

export function Dashboard() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [opponentPlayers, setOpponentPlayers] = useState("");
  const [scheduledStart, setScheduledStart] = useState(defaultMatchupTime);
  const [locationName, setLocationName] = useState("");
  const [editingTeam, setEditingTeam] = useState(false);
  const [editingGameId, setEditingGameId] = useState("");
  const [editScheduledStart, setEditScheduledStart] = useState("");
  const [editLocationName, setEditLocationName] = useState("");
  const [savingGameId, setSavingGameId] = useState("");
  const [deletingGameId, setDeletingGameId] = useState("");
  const [error, setError] = useState("");

  const loadSetup = useCallback(async () => {
    const [gamesResponse, teamsResponse] = await Promise.all([
      fetch("/api/games", { cache: "no-store" }),
      fetch("/api/setup/teams", { cache: "no-store" })
    ]);
    const gamesData = await gamesResponse.json();
    const teamsData = await teamsResponse.json();
    setGames(gamesData.games);
    setTeams(teamsData.teams);
    setSelected((value) => {
      if (value && gamesData.games.some((game: GameSummary) => game.gameId === value)) {
        return value;
      }
      const savedGameId = window.localStorage.getItem(activeGameStorageKey) ?? "";
      return gamesData.games.some(
        (game: GameSummary) => game.gameId === savedGameId
      )
        ? savedGameId
        : "";
    });
    setAwayTeamId((value) => value || teamsData.teams[0]?.teamId || "");
    setHomeTeamId((value) => value || teamsData.teams[1]?.teamId || "");
  }, []);

  useEffect(() => {
    loadSetup().catch((reason) => setError(String(reason)));
  }, [loadSetup]);

  async function createOpponent() {
    const response = await fetch("/api/setup/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: opponentName,
        playerNames: opponentPlayers.split(/\r?\n/)
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const { team } = await response.json();
    await loadSetup();
    setAwayTeamId(team.teamId);
    setOpponentName("");
    setOpponentPlayers("");
  }

  async function createGame() {
    setError("");
    const response = await fetch("/api/setup/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        awayTeamId,
        homeTeamId,
        scheduledStartUtc: scheduledStart
          ? new Date(scheduledStart).toISOString()
          : undefined,
        locationName
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const { gameId } = await response.json();
    await loadSetup();
    window.localStorage.setItem(activeGameStorageKey, gameId);
    setSelected(gameId);
  }

  async function deleteGame(game: GameSummary) {
    const confirmed = window.confirm(
      `Delete ${game.awayTeamName} at ${game.homeTeamName} and all of its recorded events, roster snapshots, replay data, and audit records?`
    );
    if (!confirmed) return;

    setDeletingGameId(game.gameId);
    setError("");
    try {
      const response = await fetch(`/api/games/${game.gameId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await response.text());
      if (
        window.localStorage.getItem(activeGameStorageKey) === game.gameId
      ) {
        window.localStorage.removeItem(activeGameStorageKey);
      }
      setSelected((value) => (value === game.gameId ? "" : value));
      await loadSetup();
    } finally {
      setDeletingGameId("");
    }
  }

  function beginEditGame(game: GameSummary) {
    setEditingGameId(game.gameId);
    setEditScheduledStart(localDateTimeValue(game.scheduledStartUtc));
    setEditLocationName(game.locationName ?? "");
    setError("");
  }

  function cancelEditGame() {
    setEditingGameId("");
    setEditScheduledStart("");
    setEditLocationName("");
  }

  async function saveGameDetails(gameId: string) {
    setSavingGameId(gameId);
    setError("");
    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledStartUtc: editScheduledStart
            ? new Date(editScheduledStart).toISOString()
            : undefined,
          locationName: editLocationName
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await loadSetup();
      cancelEditGame();
    } finally {
      setSavingGameId("");
    }
  }

  function openGame(gameId: string) {
    window.localStorage.setItem(activeGameStorageKey, gameId);
    setSelected(gameId);
  }

  function changeMatchup() {
    window.localStorage.removeItem(activeGameStorageKey);
    setSelected("");
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Springfield Little League</p>
          <h1>Game Day Command Center</h1>
          <p className="lede">Choose the matchup, arrange the lineups, then call Play Ball.</p>
        </div>
        <div className="live-pill"><span /> Local data connected</div>
      </header>

      {!selected ? (
        <section className="pregame-builder">
          <div className="section-heading">
            <div><p className="eyebrow">Pregame</p><h2>Choose Two Teams</h2></div>
            <button
              className="edit-team-button"
              onClick={() => setEditingTeam((value) => !value)}
            >
              {editingTeam ? "Close Editor" : "Edit Team"}
            </button>
          </div>
          {editingTeam ? (
            <TeamEditor
              teams={teams}
              initialTeamId={awayTeamId}
              onSaved={loadSetup}
              onClose={() => setEditingTeam(false)}
            />
          ) : null}
          <div className="team-picker">
            <label>Away team
              <select value={awayTeamId} onChange={(event) => setAwayTeamId(event.target.value)}>
                {teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}
              </select>
            </label>
            <span className="versus">at</span>
            <label>Home team
              <select value={homeTeamId} onChange={(event) => setHomeTeamId(event.target.value)}>
                {teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}
              </select>
            </label>
            <label>Matchup date and time
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={(event) => setScheduledStart(event.target.value)}
              />
            </label>
            <label>Location
              <input
                value={locationName}
                placeholder="Field name or street address"
                onChange={(event) => setLocationName(event.target.value)}
              />
            </label>
            <button onClick={() => void createGame().catch((reason) => setError(String(reason)))}>Set Matchup</button>
          </div>
          <details className="new-opponent">
            <summary>Create a new opponent</summary>
            <div className="opponent-form">
              <label>Team name<input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} /></label>
              <label>Player names, one per line<textarea value={opponentPlayers} onChange={(event) => setOpponentPlayers(event.target.value)} placeholder="Leave blank to create 11 placeholders" /></label>
              <button disabled={!opponentName.trim()} onClick={() => void createOpponent().catch((reason) => setError(String(reason)))}>Create Opponent</button>
            </div>
          </details>
          <div className="existing-games">
            <h3>Or continue a matchup</h3>
            {games.map((game) => (
              <article className="matchup-card" key={game.gameId}>
                <div className="matchup-card-actions">
                  <button
                    className="matchup-edit"
                    aria-label={`Edit ${game.awayTeamName} at ${game.homeTeamName}`}
                    title="Edit matchup"
                    disabled={editingGameId === game.gameId}
                    onClick={() => beginEditGame(game)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5Zm17.7-10.6a1 1 0 0 0 0-1.4l-2.2-2.2a1 1 0 0 0-1.4 0l-1.7 1.7 3.5 3.5 1.8-1.6Z" />
                    </svg>
                  </button>
                  <button
                    className="matchup-delete"
                    aria-label={`Delete ${game.awayTeamName} at ${game.homeTeamName}`}
                    title="Delete matchup"
                    disabled={deletingGameId === game.gameId}
                    onClick={() =>
                      void deleteGame(game).catch((reason) =>
                        setError(String(reason))
                      )
                    }
                  >
                    x
                  </button>
                </div>
                <button
                  className="matchup-open"
                  disabled={editingGameId === game.gameId}
                  onClick={() => openGame(game.gameId)}
                >
                  <strong>{game.awayTeamName} at {game.homeTeamName}</strong>
                  <span>{formatMatchupTime(game.scheduledStartUtc)}</span>
                  <small>{game.status.replace("_", " ")}</small>
                </button>
                {editingGameId === game.gameId ? (
                  <div className="matchup-editor">
                    <label>Date and time
                      <input
                        type="datetime-local"
                        value={editScheduledStart}
                        onChange={(event) =>
                          setEditScheduledStart(event.target.value)
                        }
                      />
                    </label>
                    <label>Location
                      <input
                        value={editLocationName}
                        placeholder="Field name or street address"
                        onChange={(event) =>
                          setEditLocationName(event.target.value)
                        }
                      />
                    </label>
                    <div className="matchup-editor-actions">
                      <button
                        className="ghost-button"
                        disabled={savingGameId === game.gameId}
                        onClick={cancelEditGame}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={savingGameId === game.gameId}
                        onClick={() =>
                          void saveGameDetails(game.gameId).catch((reason) =>
                            setError(String(reason))
                          )
                        }
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : game.locationName ? (
                  <a
                    className="matchup-location"
                    href={navigationUrl(game.locationName)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Navigate to ${game.locationName}`}
                  >
                    {game.locationName}
                  </a>
                ) : (
                  <span className="matchup-location missing">
                    Location not set
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <button className="back-button" onClick={changeMatchup}>Change matchup</button>
          <GameWorkspace gameId={selected} />
        </>
      )}
      {error ? <div className="error">{error}</div> : null}
    </main>
  );
}
