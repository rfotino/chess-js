const WHITE = 'W';
const BLACK = 'B';

const PAWN =   'P';
const ROOK =   'R';
const KNIGHT = 'N';
const BISHOP = 'B';
const KING =   'K';
const QUEEN =  'Q';

const EMPTY = '  ';

// https://en.wikipedia.org/wiki/Chess_symbols_in_Unicode
const ASCII_TO_UNICODE = Object.freeze({
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

exports.WHITE = WHITE;
exports.BLACK = BLACK;
exports.ASCII_TO_UNICODE = ASCII_TO_UNICODE;

exports.ChessGame = class ChessGame {
  constructor(gameId) {
    this._gameId = gameId;
    this._whitePlayerId = null;
    this._blackPlayerId = null;
    this._board = [
      ['BR', 'BB', 'BN', 'BQ', 'BK', 'BN', 'BB', 'BR'],
      ['BP', 'BP', 'BP', 'BP', 'BP', 'BP', 'BP', 'BP'],
      ['  ', '  ', '  ', '  ', '  ', '  ', '  ', '  '],
      ['  ', '  ', '  ', '  ', '  ', '  ', '  ', '  '],
      ['  ', '  ', '  ', '  ', '  ', '  ', '  ', '  '],
      ['  ', '  ', '  ', '  ', '  ', '  ', '  ', '  '],
      ['WP', 'WP', 'WP', 'WP', 'WP', 'WP', 'WP', 'WP'],
      ['WR', 'WB', 'WN', 'WQ', 'WK', 'WN', 'WB', 'WR'],
    ];
    this._whoseTurn = WHITE;
    this._castlingInfo = {};
    this._castlingInfo[WHITE] = {kingSide: true, queenSide: true};
    this._castlingInfo[BLACK] = {kingSide: true, queenSide: true};
    this._enPassantInfo = {
      available: false,
      dstPos: null,  // Position pawn would move to capture
      capturePos: null,  // Position of the to-be-captured pawn
    };
  }

  addPlayer(playerId, color) {
    if (color === WHITE) {
      if (this._whitePlayerId === null) {
	this._whitePlayerId = playerId;
	return {success: true};
      } else {
	return {success: false, message: 'White is already assigned.'};
      }
    } else if (color === BLACK) {
      if (this._blackPlayerId === null) {
	this._blackPlayerId = playerId;
	return {success: true};
      } else {
	return {success: false, message: 'Black is already assigned.'};
      }
    } else {
      return {
	success: false,
	message: `Invalid color ${color}, must be one of ${WHITE} or ${BLACK}`,
      };
    }
  }

  getOpenSeats() {
    let emptySeats = [];
    if (this._whitePlayerId === null) {
      emptySeats.push(WHITE);
    }
    if (this._blackPlayerId === null) {
      emptySeats.push(BLACK);
    }
    return emptySeats;
  }

  isReadyToStart() {
    return this.getOpenSeats().length === 0;
  }

  // Do a deep copy of the board so we can make modifications
  // that might be reversed
  _cloneBoard(board) {
    let newBoard = [];
    board.forEach(row => {
      let newRow = [];
      row.forEach(sq => newRow.push(sq));
      newBoard.push(newRow);
    });
    return newBoard;
  }

  // Do a deep clone of castling info so we can make modifications
  // that might be reversed
  _cloneCastlingInfo(castlingInfo) {
    let newCastlingInfo = {};
    newCastlingInfo[WHITE] = {
      kingSide: castlingInfo[WHITE].kingSide,
      queenSide: castlingInfo[WHITE].queenSide,
    };
    newCastlingInfo[BLACK] = {
      kingSide: castlingInfo[BLACK].kingSide,
      queenSide: castlingInfo[BLACK].queenSide,
    };
    return newCastlingInfo;
  }

  // Return true if the position is empty. Return false if it is off the board,
  // or if it is occupied by a piece
  _isEmpty(board, rank, file) {
    if (rank >= 0 && rank < board.length) {
      if (file >= 0 && file < board[rank].length) {
	return board[rank][file] === EMPTY;
      }
    }
    return false;
  }

  // Return true if the position is occupied by a piece of the given color.
  // Return false if position is off the board, is occupied by the opposite
  // color, or is empty.
  _isColor(board, rank, file, color) {
    if (rank >= 0 && rank < board.length) {
      if (file >= 0 && file < board[rank].length) {
	return board[rank][file][0] === color;
      }
    }
    return false;
  }

  // Return true if the position is empty, or occupied by a piece of the
  // given color
  _isEmptyOrColor(board, rank, file, color) {
    return this._isEmpty(board, rank, file) || this._isColor(board, rank, file, color);
  }

  // Get destination position of all moves that the piece at pos can
  // make, taking into account the type of the piece and what obstructions
  // are on the board. Do not consider castling, and do not
  // consider whether your king will be placed in check. Those will
  // be handled separately. DO take into account en passant.
  _getMovesFromPosition(board, pos, enPassantInfo) {
    const piece = board[pos.rank][pos.file];
    const color = piece[0];
    const enemyColor = color === WHITE ? BLACK : WHITE;
    const type = piece[1];
    let moves = [];
    if (type === PAWN) {
      const pawnDir = color === WHITE ? -1 : 1;
      // Check if pawn can move up one space
      if (this._isEmpty(board, pos.rank + pawnDir, pos.file)) {
	moves.push({rank: pos.rank + pawnDir, file: pos.file});
	// Check if pawn can move up two spaces
	if (this._isEmpty(board, pos.rank + (pawnDir * 2), pos.file)) {
	  moves.push({rank: pos.rank + (pawnDir * 2), file: pos.file});
	}
      }
      // Check if can capture diagonally left
      if (this._isColor(board, pos.rank + pawnDir, pos.file - 1, enemyColor)) {
	moves.push({rank: pos.rank + pawnDir, file: pos.file - 1});
      }
      // Check if can capture diagonally right
      if (this._isColor(board, pos.rank + pawnDir, pos.file + 1, enemyColor)) {
	moves.push({rank: pos.rank + pawnDir, file: pos.file + 1});
      }
      // Check if can capture en passant
      if (enPassantInfo.available &&
	  pos.rank + pawnDir === enPassantInfo.dstPos.rank &&
	  Math.abs(pos.file - enPassantInfo.dstPos.file) === 1) {
	moves.push(enPassantInfo.dstPos);
      }
    } else if (type === KNIGHT) {
      [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(delta => {
	const dst = {rank: pos.rank + delta[0], file: pos.file + delta[1]};
	if (this._isEmptyOrColor(board, dst.rank, dst.file, enemyColor)) {
	  moves.push(dst);
	}
      });
    } else if (type === KING) {
      for (let y = -1; y <= 1; y++) {
	for (let x = -1; x <= 1; x++) {
	  if (y === 0 && x === 0) {
	    continue;
	  }
	  const dst = {rank: pos.rank + y, file: pos.file + x};
	  if (this._isEmptyOrColor(board, dst.rank, dst.file, enemyColor)) {
	    moves.push(dst);
	  }
	}
      }
    } else if (type === QUEEN || type === BISHOP || type === ROOK) {
      let directions = [];
      if (type === QUEEN || type === BISHOP) {
	directions = directions.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
      }
      if (type === QUEEN || type === ROOK) {
	directions = directions.concat([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      }
      directions.forEach(dir => {
	let rank = pos.rank;
	let file = pos.file;
	while (true) {
	  rank += dir[0];
	  file += dir[1];
	  if (this._isEmpty(board, rank, file)) {
	    moves.push({rank: rank, file: file});
	  } else if (this._isColor(board, rank, file, enemyColor)) {
	    moves.push({rank: rank, file: file});
	    break;
	  } else {
	    break;
	  }
	}
      });
    }
    return moves;
  }

  // Returns true if a piece from attackingColor can capture at testPos if it
  // is their turn with the current board configuration
  _isUnderAttack(testPos, attackingColor, board, enPassantInfo) {
    for (let rank = 0; rank < board.length; rank++) {
      for (let file = 0; file < board[rank].length; file++) {
	const piece = board[rank][file];
	if (piece !== EMPTY && piece[0] === attackingColor) {
	  const moves = this._getMovesFromPosition(
	    board, {rank: rank, file: file}, enPassantInfo
	  );
	  for (let i = 0; i < moves.length; i++) {
	    if (moves[i].rank === testPos.rank && moves[i].file === testPos.file) {
	      return true;
	    }
	  }
	}
      }
    }
    return false;
  }

  _canCastle(color, side, board, enPassantInfo, castlingInfo) {
    const enemyColor = color === WHITE ? BLACK : WHITE;
    if (side === KING) {
      if (!castlingInfo[color].kingSide) {
	return {success: false, message: 'Rook or king has moved, cannot castle.'};
      }
      const rank = color === WHITE ? 7 : 0;
      if (board[rank][5] !== EMPTY || board[rank][6] !== EMPTY) {
	return {success: false, message: 'Pieces in the way, cannot castle.'};
      }
      if (this._isUnderAttack({rank, file: 4}, enemyColor, board, enPassantInfo) ||
	  this._isUnderAttack({rank, file: 5}, enemyColor, board, enPassantInfo) ||
	  this._isUnderAttack({rank, file: 6}, enemyColor, board, enPassantInfo)) {
	return {success: false, message: 'Cannot castle from, through, or into check.'};
      }
      return {success: true};
    } else if (side === QUEEN) {
      if (!castlingInfo[color].queenSide) {
	return {success: false, message: 'Rook or king has moved, cannot castle.'};
      }
      const rank = color === WHITE ? 7 : 0;
      if (board[rank][1] !== EMPTY || board[rank][2] !== EMPTY || board[rank][3] !== EMPTY) {
	return {success: false, message: 'Pieces in the way, cannot castle.'};
      }
      if (this._isUnderAttack({rank, file: 4}, enemyColor, board, enPassantInfo) ||
	  this._isUnderAttack({rank, file: 3}, enemyColor, board, enPassantInfo) ||
	  this._isUnderAttack({rank, file: 2}, enemyColor, board, enPassantInfo)) {
	return {success: false, message: 'Cannot castle from, through, or into check.'};
      }
      return {success: true};
    }
    return {success: false, message: 'Side must be one of K, Q.'};
  }

  // Update board and castlingInfo in place, assume castling is possible from
  // _canCastle()
  _executeCastle(color, side, board, castlingInfo) {
    const rank = color === WHITE ? 7 : 0;
    if (side === KING) {
      board[rank][4] = EMPTY;
      board[rank][5] = color + ROOK;
      board[rank][6] = color + KING;
      board[rank][7] = EMPTY;
      castlingInfo[color].kingSide = false;
    } else if (side === QUEEN) {
      board[rank][4] = EMPTY;
      board[rank][3] = color + ROOK;
      board[rank][2] = color + KING;
      board[rank][0] = EMPTY;
      castlingInfo[color].queenSide = false;
    }
  }

  // move.data is of the following format:
  // {
  //   # optional, indicate castling kingside/queenside
  //   castlingSide: KING | QUEEN,
  //   # required if not castling, src/dst coordinates of the piece being moved
  //   srcPos: {rank: 0-7, file: 0-7},
  //   dstPos: {rank: 0-7, file: 0-7},
  //   # required if moving white pawn to rank 0 or black pawn to rank 7
  //   pawnPromotion: QUEEN | BISHOP | ROOK | KNIGHT,
  // }
  executeMove(move) {
    // Make copies of board/en passant info since we will be modifying them, then
    // possibly rejecting modifications if it results in check etc
    let newBoard = this._cloneBoard(this._board);
    let newEnPassantInfo = { available: false, dstPos: null, capturePos: null };
    let newCastlingInfo = this._cloneCastlingInfo(this._castlingInfo);

    // Pull members out of move.data for easy access
    const castlingSide = move.data.hasOwnProperty('castling') ? move.data.castling : null;
    const srcPos = move.data.hasOwnProperty('srcPos') ? move.data.srcPos : null;
    const dstPos = move.data.hasOwnProperty('dstPos') ? move.data.dstPos : null;
    const pawnPromotion =
      move.data.hasOwnProperty('pawnPromotion') ? move.data.pawnPromotion : null;

    // Save enemy color for easy access
    const enemyColor = this._whoseTurn === WHITE ? BLACK : WHITE;

    // Make sure the right player is making the move
    if (this._whitePlayerId !== move.playerId && this._blackPlayerId !== move.playerId) {
      return { success: false, message: 'Player is not a participant.' };
    } else if ((this._whoseTurn === WHITE && this._whitePlayerId !== move.playerId) ||
	       (this._whoseTurn === BLACK && this._blackPlayerId !== move.playerId)) {
      return { success: false, message: 'It is not your turn.' };
    }

    // Handle castling
    if (castlingSide !== null) {
      const canCastle = this._canCastle(
	this._whoseTurn,
	castlingSide,
	newBoard,
	newEnPassantInfo,
	newCastlingInfo
      );
      if (!canCastle.success) {
	return canCastle;
      }
      this._executeCastle(this._whoseTurn, castlingSide, newBoard, newCastlingInfo);
    } else {
      // Make sure the source piece exists and is the right color
      const srcPiece =
	    this._board[srcPos.rank][srcPos.file];
      if (srcPiece[0] !== this._whoseTurn) {
	return {
	  success: false,
	  message: 'You do not own a piece at this position.',
	};
      }

      // Check if the destination is valid for this piece
      const possibleMoves = this._getMovesFromPosition(this._board, srcPos, this._enPassantInfo);
      let isDstValid = false;
      possibleMoves.forEach(dst => {
	if (dst.rank == dstPos.rank && dst.file == dstPos.file) {
	  isDstValid = true;
	}
      });
      if (isDstValid) {
	// Execute the move
	newBoard[dstPos.rank][dstPos.file] = newBoard[srcPos.rank][srcPos.file];
	newBoard[srcPos.rank][srcPos.file] = EMPTY;

	// Handle en passant capture
	if (srcPiece[1] === PAWN && this._enPassantInfo.available &&
	    this._enPassantInfo.dstPos.rank === dstPos.rank &&
	    this._enPassantInfo.dstPos.file === dstPos.file) {
	  newBoard[this._enPassantInfo.capturePos.rank][this._enPassantInfo.capturePos.file] = EMPTY
	}

	// Handle en passant setup by pawn moving two spaces
	if (srcPiece[1] === PAWN && srcPos.rank === 1 && dstPos.rank === 3) {
	  newEnPassantInfo = {
	    available: true,
	    dstPos: {rank: 2, file: dstPos.file},
	    capturePos: dstPos,
	  };
	} else if (srcPiece[1] === PAWN && srcPos.rank === 6 && dstPos.rank == 4) {
	  newEnPassantInfo = {
	    available: true,
	    dstPos: {rank: 5, file: dstPos.file},
	    capturePos: dstPos,
	  };
	}

	// Handle pawn promotion
	if (srcPiece[1] == PAWN && (dstPos.rank == 0 || dstPos.rank == 7)) {
	  if (![KNIGHT, BISHOP, ROOK, QUEEN].includes(pawnPromotion)) {
	    return {success: false, message: 'Invalid pawn promotion.'};
	  }
	  newBoard[dstPos.rank][dstPos.file] = this._whoseTurn + pawnPromotion;
	}
      } else {
	return {success: false, message: 'Cannot move to this position.'};
      }

      // Make sure the move would not result in current player being in check
      if (this._isInCheck(this._whoseTurn, newBoard, newEnPassantInfo)) {
	// Vary the message depending on if you were already in check, to
	// make it clearer
	if (this._isInCheck(this._whoseTurn, this._board, this._enPassantInfo)) {
	  return {success: false, message: 'You are in check.'};
	} else {
	  return {success: false, message: 'You cannot move into check.'};
	}
      }
    }

    // Update castling info
    if (srcPos.rank === 0 && srcPos.file === 0) {
      newCastlingInfo[BLACK].queenSide = false;
    } else if (srcPos.rank === 0 && srcPos.file === 7) {
      newCastlingInfo[BLACK].kingSide = false;
    } else if (srcPos.rank === 0 && srcPos.file === 4) {
      newCastlingInfo[BLACK].queenSide = false;
      newCastlingInfo[BLACK].kingSide = false;
    } else if (srcPos.rank === 7 && srcPos.file === 0) {
      newCastlingInfo[WHITE].queenSide = false;
    } else if (srcPos.rank === 7 && srcPos.file === 7) {
      newCastlingInfo[WHITE].kingSide = false;
    } else if (srcPos.rank === 7 && srcPos.file === 4) {
      newCastlingInfo[WHITE].queenSide = false;
      newCastlingInfo[WHITE].kingSide = false;
    }

    // Move was valid, update the board and switch turns
    this._board = newBoard;
    this._enPassantInfo = newEnPassantInfo;
    this._castlingInfo = newCastlingInfo;
    this._whoseTurn = this._whoseTurn == WHITE ? BLACK : WHITE;
    return { success: true };
  }

  // Check if king from the given color is in check
  _isInCheck(color, board, enPassantInfo) {
    let kingPos = null;
    for (let rank = 0; rank < board.length; rank++) {
      for (let file = 0; file < board[rank].length; file++) {
	if (board[rank][file] === color + KING) {
	  kingPos = {rank: rank, file: file};
	  break;
	}
      }
      if (kingPos !== null) {
	break;
      }
    }
    if (kingPos === null) {
      return false;  // No king to be in check, maybe throw here
    }
    const enemyColor = color === WHITE ? BLACK : WHITE;
    return this._isUnderAttack(kingPos, enemyColor, board, enPassantInfo);
  }

  // Check if any move by the given color would result in check. Used for
  // testing both checkmate and stalemate. Include en passant and castling
  _wouldEveryMoveResultInCheck(color, board, enPassantInfo, castlingInfo) {
    for (let rank = 0; rank < board.length; rank++) {
      for (let file = 0; file < board[rank].length; file++) {
	const piece = board[rank][file];
	if (piece[0] !== color) {
	  continue;
	}
	const srcPos = {rank, file};
	const moves = this._getMovesFromPosition(board, srcPos, enPassantInfo);
	for (let i = 0; i < moves.length; i++) {
	  const dstPos = moves[i];
	  let boardCopy = this._cloneBoard(board);
	  boardCopy[dstPos.rank][dstPos.file] = boardCopy[srcPos.rank][srcPos.file];
	  boardCopy[srcPos.rank][srcPos.file] = EMPTY;
	  // Handle en passant capture. Do not have to care about future en passant setup
	  // by this move, since the availability or not of en passant does not place the
	  // king under immediate attack.
	  if (piece[1] === PAWN && enPassantInfo.available &&
	      enPassantInfo.dstPos.rank === dstPos.rank &&
	      enPassantInfo.dstPos.file === dstPos.file) {
	    boardCopy[enPassantInfo.capturePos.rank][enPassantInfo.capturePos.file] = EMPTY;
	  }
	  // Would this move result in check? If not, not in checkmate
	  if (!this._isInCheck(color, boardCopy, {available: false})) {
	    return false;
	  }
	}
      }
    }
    const sides = [KING, QUEEN];
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      if (this._canCastle(color, side, board, enPassantInfo, castlingInfo).success) {
	let boardCopy = this._cloneBoard(board);
	let castlingInfoCopy = this._cloneCastlingInfo(castlingInfo);
	this._executeCastle(color, side, boardCopy, castlingInfoCopy);
	if (!this._isInCheck(color, boardCopy, {available: false})) {
	  return false;
	}
      }
    }
    return true;
  }

  // Requirements for checkmate:
  // 1) King is in check
  // 2) Any move by any piece (including the king) still results in check
  //
  // NOTES:
  // The set of all possible moves by the side being tested does NOT
  // have to include castling, thankfully, because castling is not possible
  // if you are in check. However we have to pass through castling info
  // anyway for simplicity to the helper function, which is used elsewhere.
  // The set of possible moves DOES include en passant capture, since this
  // can get you out of check. It does NOT have to include pawn promotion,
  // since the type of piece the pawn promotes to has no effect on getting
  // out of check.
  _isInCheckmate(whoseTurn, board, enPassantInfo, castlingInfo) {
    return (
      this._isInCheck(whoseTurn, board, enPassantInfo) &&
      this._wouldEveryMoveResultInCheck(
        whoseTurn, board, enPassantInfo, castlingInfo
      )
    );
  }

  // Requirements for stalemate:
  // 1) King is NOT in check
  // 2) Any move by any piece (including the king) would result in check
  //
  // NOTES:
  // Unlike checkmate, we DO have to account for castling here, because
  // if you are not in check you can possibly castle and still not
  // be in check.
  _isInStalemate(whoseTurn, board, enPassantInfo, castlingInfo) {
    return (
      !this._isInCheck(whoseTurn, board, enPassantInfo) &&
      this._wouldEveryMoveResultInCheck(
        whoseTurn, board, enPassantInfo, castlingInfo
      )
    );
  }

  // Only test for checkmate or stalemate, no other types of draw implemented
  // at this time, see https://en.wikipedia.org/wiki/Draw_(chess) for an
  // exhaustive list of conditions that could be implemented.
  isGameOver() {
    return (
      this._isInCheckmate(WHITE, this._board, this._enPassantInfo, this._castlingInfo) ||
      this._isInCheckmate(BLACK, this._board, this._enPassantInfo, this._castlingInfo) ||
      this._isInStalemate(this._whoseTurn, this._board, this._enPassantInfo, this._castlingInfo)
    );
  }

  // Output of this function requires isGameOver() === true as a precondition,
  // so if winner is null a draw is assumed.
  getWinner() {
    if (this._isInCheckmate(
      WHITE, this._board, this._enPassantInfo, this._castlingInfo
    )) {
      return BLACK;
    } else if (this._isInCheckmate(
      BLACK, this._board, this._enPassantInfo, this._castlingInfo
    )) {
      return WHITE;
    }
    return null;
  }

  // Info that the client needs to show the UI
  toObj(playerId = null) {
    let obj = {
      gameId: this._gameId,
      readyToStart: this.isReadyToStart(),
      gameOver: this.isGameOver(),
      winner: this.getWinner(),
      whoseTurn: this._whoseTurn,
      board: this._board,
      enPassantInfo: this._enPassantInfo,
      castlingInfo: this._castlingInfo,
      openSeats: this.getOpenSeats(),
    };
    if (playerId !== null && playerId === this._whitePlayerId) {
      obj.myColor = WHITE;
    } else if (playerId !== null && playerId === this._blackPlayerId) {
      obj.myColor = BLACK;
    }
    return obj;
  }

  toPrettyConsoleString() {
    // ANSI escape codes to change terminal colors
    const RESET = '\x1b[0m';
    const FGBLACK = '\x1b[30m';
    const BGWHITE = '\x1b[47m';
    const BGBLACK = '\x1b[45m';

    let isBgWhite = true;
    let rowNum = -1
    return '  0 1 2 3 4 5 6 7\n' + this._board.map(row => {
      isBgWhite = !isBgWhite;
      rowNum += 1;
      return rowNum + ' ' + row.map(sq => {
	isBgWhite = !isBgWhite;
	return (
	  FGBLACK +
	  (isBgWhite ? BGWHITE : BGBLACK) +
	  ASCII_TO_UNICODE[sq] + ' ' +
	  RESET
	);
      }).join('');
    }).join('\n');
  }
};
