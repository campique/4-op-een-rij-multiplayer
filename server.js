const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const games = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createGame', () => {
    const gameId = Math.random().toString(36).substring(7);
    games.set(gameId, { players: [socket.id], board: Array(6).fill().map(() => Array(7).fill('')) });
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  socket.on('joinGame', (gameId) => {
    const game = games.get(gameId);
    if (game && game.players.length < 2) {
      game.players.push(socket.id);
      socket.join(gameId);
      io.to(gameId).emit('gameJoined', game.players);
      if (game.players.length === 2) {
        io.to(gameId).emit('gameStart', Math.round(Math.random()));
      }
    } else {
      socket.emit('gameFull');
    }
  });

  socket.on('makeMove', ({ gameId, col }) => {
    const game = games.get(gameId);
    if (game) {
      const row = findLowestEmptyRow(game.board, col);
      if (row !== -1) {
        const currentPlayer = game.players.indexOf(socket.id);
        game.board[row][col] = currentPlayer;
        io.to(gameId).emit('moveMade', { row, col, player: currentPlayer });
        
        if (checkWin(game.board, row, col)) {
          io.to(gameId).emit('gameOver', { winner: currentPlayer });
        } else if (checkDraw(game.board)) {
          io.to(gameId).emit('gameOver', { draw: true });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

function findLowestEmptyRow(board, col) {
  for (let row = 5; row >= 0; row--) {
    if (board[row][col] === '') {
      return row;
    }
  }
  return -1;
}

function checkWin(board, row, col) {
  const player = board[row][col];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    let count = 1;
    for (let i = 1; i < 4; i++) {
      const newRow = row + i * dx;
      const newCol = col + i * dy;
      if (newRow < 0 || newRow >= 6 || newCol < 0 || newCol >= 7 || board[newRow][newCol] !== player) {
        break;
      }
      count++;
    }
    for (let i = 1; i < 4; i++) {
      const newRow = row - i * dx;
      const newCol = col - i * dy;
      if (newRow < 0 || newRow >= 6 || newCol < 0 || newCol >= 7 || board[newRow][newCol] !== player) {
        break;
      }
      count++;
    }
    if (count >= 4) {
      return true;
    }
  }
  return false;
}

function checkDraw(board) {
  return board.every(row => row.every(cell => cell !== ''));
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
