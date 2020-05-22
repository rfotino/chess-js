const http = require('http');
const crypto = require("crypto");
const fs = require('fs');

const chess = require('./chess.js')

const hostname = '127.0.0.1';
const port = 3000;

let playerIds = new Set();
let games = new Map();

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
  '/api/create-player-id': function(getParams, postParams, res) {
    let playerId = '';
    while (true) {
      playerId = crypto.randomBytes(8).toString('hex');
      if (!playerIds.has(playerId)) {
	playerIds.add(playerId);
	break;
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(playerId);
  },
  '/api/create-game': function(getParams, postParams, res) {
    let gameId = '';
    while (true) {
      gameId = crypto.randomBytes(8).toString('hex');
      if (!games.has(gameId)) {
	games.set(gameId, new chess.ChessGame(gameId));
	break;
      }
    }
    let playerId = null;
    if (postParams.hasOwnProperty('playerId') &&
	postParams.hasOwnProperty('role')) {
      playerId = postParams.playerId;
      //games.get(gameId).addPlayer(playerId, postParams.role);
      // TODO: right now add player to both roles for testing
      games.get(gameId).addPlayer(playerId, chess.WHITE);
      games.get(gameId).addPlayer(playerId, chess.BLACK);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/json');
    res.end(JSON.stringify(games.get(gameId).toObj(playerId)));
  },
  '/api/add-player': function(getParams, postParams, res) {
    // TODO: Somehow be able to add a second player, probably
    // not with an API call. Second player will visit special
    // URL and may have to have playerId generated
    res.statusCode = 501;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not implemented');
  },
  '/api/execute-move': function(getParams, postParams, res) {
    if (!getParams.has('gameId') ||
	!postParams.hasOwnProperty('move') ||
	!postParams.hasOwnProperty('playerId')) {
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
      const result = game.executeMove(move);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(JSON.stringify({
	moveResult: result,
	gameStatus: game.toObj(postParams.playerId),
      }));
    }
  },
};

const API_GET_METHODS = {
  '/api/get-game': function(params, res) {
    if (params.has('id') && games.has(params.get('id'))) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/json');
      res.end(JSON.stringify(games.get(params.get('id')).toObj()));
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

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  const url = parseUrl(req.url);

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
      API_GET_METHODS[url.path](url.params, res);
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
	API_POST_METHODS[url.path](url.params, postParams, res);
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
