// Move class contains the id of the player making the move,
// plus an object representation of the move itself which is
// specific to the game being played.
exports.Move = class Move {
  constructor(playerId, data) {
    this._playerId = playerId;
    this._data = data;
  }

  get playerId() {
    return this._playerId;
  }

  get data() {
    return this._data;
  }
};

exports.Game = class Game {
  constructor(gameId) {
    this._gameId = gameId;
    this._playerIdToRole = new Map();
    this._roleToPlayerId = new Map();
  }

  // Returns {success: boolean, message: string}
  addPlayer(playerId, role) {
    this._playerIdToRole.set(playerId, role);
    this._roleToPlayerId.set(role, playerId);
  }

  // override, return true if players have been added to all roles
  isReadyToStart() {
    return false;
  }

  // override, returns object with success set to true/false
  // depending on if the move was successful. If unsuccessful (because
  // the move was invalid) include an error message to return to the
  // client.
  executeMove(move) {
    return {
      success: false,
      message: 'executeMove() not implemented',
    };
  }

  // override, check for win/lose/draw conditions
  isGameOver() {
    return false;
  }

  // override, return the player id who won or null if a draw
  // requires isGameOver() == true
  getWinner() {
    return null;
  }
};
