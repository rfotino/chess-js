var WHITE = 'W';
var BLACK = 'B';
var BOARD_SIZE = 8;

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
	var response = JSON.parse(xhr.responseText);
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
	var response = JSON.parse(xhr.responseText);
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
    srcPos: {
      rank: showBlackOnBottom ?
	BOARD_SIZE - fromSquare.rank - 1: fromSquare.rank,
      file: showBlackOnBottom ?
	BOARD_SIZE - fromSquare.file - 1 : fromSquare.file,
    },
    dstPos: {
      rank: showBlackOnBottom ?
	BOARD_SIZE- toSquare.rank - 1 : toSquare.rank,
      file: showBlackOnBottom ?
	BOARD_SIZE - toSquare.file - 1 : toSquare.file,
    },
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

function joinGame(color) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/add-player?gameId=' + getGameIdFromURL());
  xhr.onreadystatechange = function() {
    if (xhr.status === 200) {
      var response = JSON.parse(xhr.responseText);
      updateBoard(response);
    } else if (xhr.status === 400) {
      messageElem.innerHTML = 'Error joining game, please try again.';
      console.log('Error joining game', xhr.statusText, xhr.responseText);
    }
  };
  setPlayerId(function() {
    xhr.send(JSON.stringify({
      role: color,
    }));
  });
}
function joinAsWhite() {
  joinGame(WHITE);
}
function joinAsBlack() {
  joinGame(BLACK);
}

// Button handler for copying link to clipboard for sharing.
// Taken from https://www.w3schools.com/howto/howto_js_copy_clipboard.asp
function copyLink() {
  var linkInput = document.getElementById('share-link-input');
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  document.execCommand('copy');
}

var showBlackOnBottom = false;
function updateBoard(game) {
  // Update status message
  if (!game.readyToStart) {
    if (game.hasOwnProperty('myColor')) {
      var copyButton = '<button onclick="copyLink()">Copy</button>';
      var linkInput = (
	'<input type="text" value="' +
	window.location.href +
	'" id="share-link-input" />'
      );
      var link = (
	'<a href="' + window.location.href + '">' +
	window.location.href + '</a>'
      );
      messageElem.innerHTML = (
	'Waiting for players to join. ' +
	'Share this URL to allow another person to join/spectate: ' +
	linkInput + ' ' + copyButton
      );
    } else {
      messageElem.innerHTML = 'Join the game or wait to spectate.';
    }
  } else if (game.gameOver) {
    if (game.winner === WHITE) {
      messageElem.innerHTML = 'Checkmate, white wins.';
    } else if (game.winner === BLACK) {
      messageElem.innerHTML = 'Checkmate, black wins.';
    } else {
      messageElem.innerHTML = 'Game ended in a draw.';
    }
  } else if (game.whoseTurn === WHITE) {
    messageElem.innerHTML = "White's turn.";
  } else if (game.whoseTurn === BLACK) {
    messageElem.innerHTML = "Black's turn.";
  }

  // Show/hide join buttons depending on if there are open seats
  var joinButtonsContainer = document.getElementById('join-buttons');
  var joinAsWhiteButton = document.getElementById('join-as-white');
  var joinAsBlackButton = document.getElementById('join-as-black');
  if (!game.hasOwnProperty('myColor') && game.openSeats.length > 0) {
    joinButtonsContainer.style.display = 'block';
    joinAsWhiteButton.style.display =
      game.openSeats.includes(WHITE) ? 'inline-block' : 'none';
    joinAsBlackButton.style.display =
      game.openSeats.includes(BLACK) ? 'inline-block' : 'none';
  } else {
    joinButtonsContainer.style.display = 'none';
  }

  // Update pieces shown on the board, previous move highlights, and check highlights
  showBlackOnBottom = (
    game.hasOwnProperty('myColor') &&
    game.myColor === BLACK
  );
  for (var screenRank = 0; screenRank < game.board.length; screenRank++) {
    for (var screenFile = 0; screenFile < game.board[screenRank].length; screenFile++) {
      var squareElem = document.getElementById('sq-' + screenRank + '-' + screenFile);
      var gameRank = showBlackOnBottom ?
	  game.board.length - screenRank - 1 : screenRank;
      var gameFile = showBlackOnBottom ?
	  game.board[gameRank].length - screenFile - 1 : screenFile;
      squareElem.innerHTML = ASCII_TO_UNICODE[game.board[gameRank][gameFile]];
      // Check if square was site of src/dst position of previous move, so
      // we can highlight that square and indicate the last move to both
      // players
      if ((game.prevSrcPos !== null &&
	   game.prevSrcPos.rank === gameRank && game.prevSrcPos.file === gameFile) ||
	  (game.prevDstPos !== null &&
	   game.prevDstPos.rank === gameRank && game.prevDstPos.file === gameFile)) {
	squareElem.innerHTML =
	  '<div class="move-highlight">' + squareElem.innerHTML + '</div>';
      }
      // Check if square is the site of check, if so highlight red
      if (game.checkPiece === game.board[gameRank][gameFile]) {
	squareElem.innerHTML =
	  '<div class="check-highlight">' + squareElem.innerHTML + '</div>';
      }
    }
  }
}

function waitForUpdates(gameId) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api/wait-for-updates?gameId=' + gameId);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
	var response = JSON.parse(xhr.responseText);
	updateBoard(response);
      }
      // Not found means game no longer exists on
      // the server, no point in polling repeatedly
      if (xhr.status !== 404) {
	waitForUpdates(gameId);
      }
    }
  };
  xhr.send();
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
	  var response = JSON.parse(xhr.responseText);
	  updateBoard(response);
	  waitForUpdates(gameId);
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
