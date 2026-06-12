export class GameEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GameEngineError";
    this.code = code;
  }
}

export class NotAuthorizedError extends GameEngineError {
  constructor(action: string, resource: string) {
    super("NOT_AUTHORIZED", `Not authorized to ${action} ${resource}`);
    this.name = "NotAuthorizedError";
  }
}

export class GameNotFoundError extends GameEngineError {
  constructor(gameId: string) {
    super("GAME_NOT_FOUND", `Game not found: ${gameId}`);
    this.name = "GameNotFoundError";
  }
}

export class TeamNotFoundError extends GameEngineError {
  constructor(teamId: string) {
    super("TEAM_NOT_FOUND", `Team not found: ${teamId}`);
    this.name = "TeamNotFoundError";
  }
}

export class PlayerNotOnGameRosterError extends GameEngineError {
  constructor(playerId: string, gameId: string) {
    super(
      "PLAYER_NOT_ON_GAME_ROSTER",
      `Player ${playerId} is not on game roster ${gameId}`
    );
    this.name = "PlayerNotOnGameRosterError";
  }
}
