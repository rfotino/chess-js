const chess = require('./chess.js');
const gameId = 'dummy';
let castlingInfo = {};
castlingInfo[chess.WHITE] = {kingSide: false, queenSide: false};
castlingInfo[chess.BLACK] = {kingSide: false, queenSide: false};
const enPassantInfo = {
  available: false,
  dstPos: null,
  capturePos: null,
};

/* CHECKMATES */
const checkmates = require('./test/checkmates.json');
for (const board of checkmates[chess.WHITE]) {
  const game = new chess.ChessGame(
    gameId, board, chess.BLACK, castlingInfo, enPassantInfo
  );
  const gameOver = game.isGameOver();
  const winner = game.getWinner();
  if (!gameOver) {
    console.log('Game should be over, but is not:');
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  } else if (winner !== chess.WHITE) {
    console.log(`Winner should be white, but is ${winner}`);
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  }
}
for (const board of checkmates[chess.BLACK]) {
  const game = new chess.ChessGame(
    gameId, board, chess.WHITE, castlingInfo, enPassantInfo
  );
  const gameOver = game.isGameOver();
  const winner = game.getWinner();
  if (!gameOver) {
    console.log('Game should be over, but is not:');
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  } else if (winner !== chess.BLACK) {
    console.log(`Winner should be black, but is ${winner}`);
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  }
}

/* DRAWS */
const draws = require('./test/draws.json');
for (const board of draws[chess.WHITE]) {
  const game = new chess.ChessGame(
    gameId, board, chess.WHITE, castlingInfo, enPassantInfo
  );
  const gameOver = game.isGameOver();
  const winner = game.getWinner();
  if (!gameOver) {
    console.log('Game should be over, but is not:');
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  } else if (winner !== null) {
    console.log(`Game should be a draw, but winner is ${winner}`);
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  }
}
for (const board of draws[chess.BLACK]) {
  const game = new chess.ChessGame(
    gameId, board, chess.BLACK, castlingInfo, enPassantInfo
  );
  const gameOver = game.isGameOver();
  const winner = game.getWinner();
  if (!gameOver) {
    console.log('Game should be over, but is not:');
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  } else if (winner !== null) {
    console.log(`Game should be a draw, but winner is ${winner}`);
    console.log(game.toPrettyConsoleString());
    process.exit(1);
  }
}
