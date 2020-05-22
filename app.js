const http = require('http');
const crypto = require("crypto");
const fs = require('fs');

const chess = require('./chess.js')

const hostname = '127.0.0.1';
const port = 3000;

let playerIds = new Set();
let games = new Map();

let gameListeners = {};
function updateListeners(gameId) {
  const game = games.get(gameId);
  gameListeners[gameId].forEach(listener => {
    const playerId = listener.playerId;
    const res = listener.res;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/json');
    res.end(JSON.stringify(game.toObj(playerId)));
  });
  gameListeners[gameId] = [];
}

const STATIC_FILES = {
  '/': {
    file: 'static/index.html',
    contentType: 'text/html',
  },
  '/game': {
    file: 'static/game.html',
    contentType: 'text/html',
  },
  '/index.js': {
    file: 'static/index.js',
    contentType: 'text/javascript',
  },
  '/styles.css': {
    file: 'static/styles.css',
    contentType: 'text/css',
  },
};

const API_POST_METHODS = {
  '/api/create-player-id': function(playerId, getParams, postParams, res) {
    let newPlayerId = '';
    while (true) {
      newPlayerId = crypto.randomBytes(8).toString('hex');
      if (!playerIds.has(newPlayerId)) {
	playerIds.add(newPlayerId);
	break;
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(newPlayerId);
  },
  '/api/create-game': function(playerId, getParams, postParams, res) {
    let gameId = '';
    while (true) {
      gameId = crypto.randomBytes(8).toString('hex');
      if (!games.has(gameId)) {
	games.set(gameId, new chess.ChessGame(gameId));
	break;
      }
    }
    if (playerId !== null && postParams.hasOwnProperty('role')) {
      games.get(gameId).addPlayer(playerId, postParams.role);
    }
    gameListeners[gameId] = [];
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/json');
    res.end(JSON.stringify(games.get(gameId).toObj(playerId)));
  },
  '/api/add-player': function(playerId, getParams, postParams, res) {
    if (!getParams.has('gameId') ||
	!postParams.hasOwnProperty('role') ||
	playerId === null) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Must have game id, player id, and role');
      return;
    } else if (!games.has(getParams.get('gameId'))) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Game not found.');
      return;
    }
    const gameId = getParams.get('gameId');
    let game = games.get(gameId);
    const result = game.addPlayer(playerId, postParams.role);
    if (result.success) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/json');
      res.end(JSON.stringify(game.toObj(playerId)));
      updateListeners(gameId);
    } else {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/json');
      res.end(`Unable to add player: ${result.message}`);
    }
  },
  '/api/execute-move': function(playerId, getParams, postParams, res) {
    if (!getParams.has('gameId') || playerId === null) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Must have game id, player id, and move info.');
    } else if (!games.has(getParams.get('gameId'))) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Game not found.');
    } else {
      const gameId = getParams.get('gameId');
      const game = games.get(gameId);
      const move = postParams.move;
      const result = game.executeMove({
	playerId: playerId,
	data: postParams,
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(JSON.stringify({
	moveResult: result,
	gameStatus: game.toObj(playerId),
      }));
      if (result.success) {
	updateListeners(gameId);
      }
    }
  },
};

const API_GET_METHODS = {
  '/api/get-game': function(playerId, params, res) {
    if (params.has('id') && games.has(params.get('id'))) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/json');
      res.end(JSON.stringify(games.get(params.get('id')).toObj(playerId)));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Game not found.');
    }
  },
  '/api/wait-for-updates': function(playerId, params, res) {
    if (params.has('gameId') && games.has(params.get('gameId'))) {
      const gameId = params.get('gameId');
      gameListeners[gameId].push({playerId, res});
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Game not found.');
    }
  },
};

function parseUrl(url) {
  let parsed = {
    path: '/',
    params: new Map(),
  };
  const pieces = url.split('?');
  if (pieces.length >= 1) {
    parsed.path = pieces[0];
  }
  if (pieces.length >= 2) {
    const paramPieces = pieces[1].split('&');
    for (let i = 0; i < paramPieces.length; i++) {
      const param = paramPieces[i].split('=');
      parsed.params.set(param[0], param[1]);
    }
  }
  return parsed;
}

function parsePlayerId(cookieStr) {
  const cookieKvps = cookieStr.split('; ');
  for (let i = 0; i < cookieKvps.length; i++) {
    const kvp = cookieKvps[i].split('=');
    if (kvp.length === 2 && kvp[0] === 'playerid') {
      return kvp[1];
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  const url = parseUrl(req.url)
  const playerId = req.headers.hasOwnProperty('cookie') ?
	parsePlayerId(req.headers.cookie) : null;

  switch (req.method) {
  case 'GET':
    if (STATIC_FILES.hasOwnProperty(url.path)) {
      const fileInfo = STATIC_FILES[url.path];
      fs.readFile(fileInfo.file, function(err, data) {
	if (err) {
	  console.log(err);
	  res.statusCode = 503;
	  res.setHeader('Content-Type', 'text/plain');
	  res.end('Internal server error.');
	} else {
	  res.statusCode = 200;
	  res.setHeader('Content-Type', fileInfo.contentType);
	  res.end(data);
	}
      });
    } else if (API_GET_METHODS.hasOwnProperty(url.path)) {
      API_GET_METHODS[url.path](playerId, url.params, res);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found.');
    }
    break;
  case 'POST':
    if (API_POST_METHODS.hasOwnProperty(url.path)) {
      let postData = '';
      req.on('data', chunk => {
	postData += chunk;
      });
      req.on('end', () => {
	const postParams = postData === '' ? {} : JSON.parse(postData);
	API_POST_METHODS[url.path](playerId, url.params, postParams, res);
      });
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found.');
    }
    break;
  default:
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method not allowed.');
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});
