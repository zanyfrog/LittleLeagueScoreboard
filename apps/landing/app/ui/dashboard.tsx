"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameSummary } from "@ll-score/game-engine";
import type { Team } from "@ll-score/contracts";
import { GameWorkspace } from "./game-workspace";
import { TeamEditor } from "./team-editor";

const activeGameStorageKey = "ll-score-active-game-id";

export function Dashboard() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [opponentPlayers, setOpponentPlayers] = useState("");
  const [editingTeam, setEditingTeam] = useState(false);
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
      body: JSON.stringify({ awayTeamId, homeTeamId })
    });
    if (!response.ok) throw new Error(await response.text());
    const { gameId } = await response.json();
    await loadSetup();
    window.localStorage.setItem(activeGameStorageKey, gameId);
    setSelected(gameId);
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
              <button key={game.gameId} onClick={() => openGame(game.gameId)}>
                <span>{game.awayTeamName} at {game.homeTeamName}</span>
                <small>{game.status.replace("_", " ")}</small>
              </button>
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
