var WHITE = 'W';
var BLACK = 'B';

// https://en.wikipedia.org/wiki/Chess_symbols_in_Unicode
var ASCII_TO_UNICODE = Object.freeze({
  WK: '\u2654',
  WQ: '\u2655',
  WR: '\u2656',
  WB: '\u2657',
  WN: '\u2658',
  WP: '\u2659',
  BK: '\u265A',
  BQ: '\u265B',
  BR: '\u265C',
  BB: '\u265D',
  BN: '\u265E',
  BP: '\u265F',
  '  ': ' ',
});


var messageElem = document.getElementById('message');

function setPlayerId(callback) {
  if (document.cookie === '') {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'api/create-player-id');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
	if (xhr.status === 200) {
	  var playerId = xhr.responseText;
	  document.cookie = 'playerid=' + playerId + '; SameSite=Strict';
	  callback();
	} else {
	  messageElem.innerHTML = 'Error creating player id, please try again.';
	  console.log("error", xhr.statusText);
	}
      }
    };
    xhr.send();
  } else {
    callback();
  }
}

function createGame(color, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/create-game');
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
	const response = JSON.parse(xhr.responseText);
	if (response.hasOwnProperty('gameId')) {
	  callback(response.gameId);
	} else {
	  messageElem.innerHTML = 'Error creating game, please try again.';
	  console.log('No game id in response', response);
	}
      } else {
	messageElem.innerHTML = 'Error creating game, please try again.';
	console.log('error', xhr.statusText);
      }
    }
  };
  xhr.send(JSON.stringify({
    role: color,
  }));
}

function getGameIdFromURL() {
  var gameId = null;
  var url = document.location.toString();
  var urlPieces = url.split('?');
  if (urlPieces.length === 2) {
    var paramPieces = urlPieces[1].split('&');
    for (let i = 0; i < paramPieces.length; i++) {
      var morePieces = paramPieces[i].split('=');
      if (morePieces.length === 2) {
	if (morePieces[0] === 'id') {
	  gameId = morePieces[1];
	  break;
	}
      }
    }
  }
  return gameId;
}

var fromSquare = {rank: -1, file: -1};
var toSquare = {rank: -1, file: -1};
var isExecutingMove = false;
function getSquareElem(rank, file) {
  return document.getElementById('sq-' + rank + '-' + file);
}
function executeMove(fromSquare, toSquare) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/execute-move?gameId=' + getGameIdFromURL());
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
	const response = JSON.parse(xhr.responseText);
	updateBoard(response.gameStatus);
	if (!response.moveResult.success) {
	  messageElem.innerHTML = response.moveResult.message;
	}
      } else if (xhr.status === 404) {
	messageElem.innerHTML = 'Game not found on server.';
      } else {
	messageElem.innerHTML = 'Unknown error executing move, try again.';
	console.log('error', xhr.status, xhr.statusText);
      }
      getSquareElem(fromSquare.rank, fromSquare.file).style.border = '0';
      getSquareElem(toSquare.rank, toSquare.file).style.border = '0';
      fromSquare.rank = fromSquare.file = -1;
      toSquare.rank = toSquare.file = -1;
      isExecutingMove = false;
    }
  };
  xhr.send(JSON.stringify({
    // TODO: support pawn promotion and castling in the UI
    srcPos: fromSquare,
    dstPos: toSquare,
    pawnPromotion: 'Q',
  }));
}
function clickSquare(rank, file) {
  if (isExecutingMove) {
    return;
  }
  if (fromSquare.rank === -1 && fromSquare.file === -1) {
    fromSquare = {rank, file};
    getSquareElem(rank, file).style.border = '3px solid black';
  } else if (fromSquare.rank === rank && fromSquare.file === file) {
    // Click same square to deselect
    fromSquare.rank = fromSquare.file = -1;
    getSquareElem(rank, file).style.border = '0';
  } else {
    toSquare = {rank, file};
    getSquareElem(rank, file).style.border = '3px solid black';
    isExecutingMove = true;
    executeMove(fromSquare, toSquare);
  }
}

function initBoard() {
  var boardElem = document.getElementById('board');
  var lightSquare = true;
  for (var rank = 0; rank < 8; rank++) {
    var rankElem = document.createElement('tr');
    rankElem.className = 'board-row';
    for (var file = 0; file < 8; file++) {
      var squareElem = document.createElement('td');
      squareElem.id = 'sq-' + rank + '-' + file;
      squareElem.className = 'board-square-' + (lightSquare ? 'light' : 'dark');
      squareElem.innerHTML = '&nbsp;';
      squareElem.addEventListener('click', (function(rank, file) {
	return function() { clickSquare(rank, file); };
      })(rank, file));
      rankElem.appendChild(squareElem);
      lightSquare = !lightSquare;
    }
    boardElem.appendChild(rankElem);
    lightSquare = !lightSquare;
  }
}

function updateBoard(response) {
  console.log(response);
  // TODO: Should say something like "waiting for other player to join"
  // or "it's your turn" or "waiting for other player to move".
  messageElem.innerHTML = 'Waiting for input.';
  for (var rank = 0; rank < response.board.length; rank++) {
    for (var file = 0; file < response.board[rank].length; file++) {
      var squareElem = document.getElementById('sq-' + rank + '-' + file);
      squareElem.innerHTML = ASCII_TO_UNICODE[response.board[rank][file]];
    }
  }
}

function loadGame() {
  initBoard();
  var gameId = getGameIdFromURL();
  if (gameId === null) {
    messageElem.innerHTML = 'No game id found in URL.';
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'api/get-game?id=' + gameId);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
	if (xhr.status === 200) {
	  const response = JSON.parse(xhr.responseText);
	  updateBoard(response);
	} else if (xhr.status === 404) {
	  messageElem.innerHTML = 'Game not found on server.';
	} else {
	  messageElem.innerHTML = 'Unknown error loading game.';
	  console.log('error', xhr.status, xhr.statusText);
	}
      }
    };
    xhr.send();
  }
}

function startGameAsWhite() {
  setPlayerId(function() {
    createGame(WHITE, function(gameId) {
      window.location.href = 'game?id=' + gameId;
    });
  });
}

function startGameAsBlack() {
  setPlayerId(function() {
    createGame(BLACK, function(gameId) {
      window.location.href = 'game?id=' + gameId;
    });
  });
}
