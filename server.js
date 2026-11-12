const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function roomList() {
  return Object.values(rooms)
    .filter(room => room.status === 'waiting')
    .map(room => ({
      code: room.code,
      host: room.players[0] ? room.players[0].name : 'Player',
      players: room.players.length
    }));
}

function updateLobby() {
  io.emit('lobbyUpdate', {
    online: io.engine.clientsCount,
    rooms: roomList()
  });
}

io.on('connection', (socket) => {
  updateLobby();

  socket.on('createRoom', ({ name }, cb) => {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();

    rooms[code] = {
      code,
      players: [{ id: socket.id, name }],
      spectators: [],
      moves: [],
      chat: [],
      status: 'waiting',
      whiteTime: 600,
      blackTime: 600,
      turn: 'w',
      lastMoveTime: Date.now()
    };

    socket.join(code);
    cb({ code, color: 'w' });
    updateLobby();
  });

  socket.on('joinRoom', ({ code, name }, cb) => {
    const room = rooms[code];

    if (!room) return cb({ error: 'Room not found' });

    if (room.players.length < 2) {
      room.players.push({ id: socket.id, name });
      socket.join(code);
      room.status = 'playing';
      room.whiteTime = 600;
      room.blackTime = 600;
      room.turn = 'w';
      room.lastMoveTime = Date.now();

      cb({ joined: 'player', code, color: 'b' });
      io.to(code).emit('roomReady', { code, hostColor: 'w' });
      io.to(code).emit('roomUpdate', {
        code,
        players: room.players,
        status: room.status
      });
    } else {
      room.spectators.push({ id: socket.id, name });
      socket.join(code);
      cb({ joined: 'spectator', code });
      io.to(code).emit('roomUpdate', {
        code,
        players: room.players,
        status: room.status
      });
    }

    updateLobby();
  });

  socket.on('joinWaitingRoom', ({ code, name }, cb) => {
    const room = rooms[code];

    if (!room) return cb({ error: 'Match no longer available' });
    if (room.status !== 'waiting') return cb({ error: 'Match already started' });

    room.players.push({ id: socket.id, name });
    socket.join(code);
    room.status = 'playing';
    room.whiteTime = 600;
    room.blackTime = 600;
    room.turn = 'w';
    room.lastMoveTime = Date.now();

    cb({ joined: 'player', code, color: 'b' });
    io.to(code).emit('roomReady', { code, hostColor: 'w' });
    io.to(code).emit('roomUpdate', {
      code,
      players: room.players,
      status: room.status
    });

    updateLobby();
  });

  socket.on('move', ({ code, move, color }) => {
    const room = rooms[code];
    if (!room) return;

    room.moves.push(move);

    if (color === 'w') {
      room.turn = 'b';
    } else {
      room.turn = 'w';
    }

    room.lastMoveTime = Date.now();

    io.to(code).emit('move', {
      move,
      turn: room.turn,
      whiteTime: room.whiteTime,
      blackTime: room.blackTime
    });
  });

  socket.on('chat', ({ code, name, text }) => {
    io.to(code).emit('chat', { name, text });
  });

  socket.on('emote', ({ code, name, emote }) => {
    io.to(code).emit('emote', { name, emote });
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.id !== socket.id);
      room.spectators = room.spectators.filter(p => p.id !== socket.id);

      if (room.players.length === 0 && room.spectators.length === 0) {
        delete rooms[code];
      } else if (room.players.length < 2) {
        room.status = 'waiting';
      }
    }

    updateLobby();
  });
});

setInterval(() => {
  const now = Date.now();

  for (const code in rooms) {
    const room = rooms[code];

    if (room.status !== 'playing') continue;

    const secondsPassed = Math.floor((now - room.lastMoveTime) / 1000);

    if (secondsPassed > 0) {
      if (room.turn === 'w') {
        room.whiteTime = Math.max(0, room.whiteTime - secondsPassed);
      } else {
        room.blackTime = Math.max(0, room.blackTime - secondsPassed);
      }

      room.lastMoveTime = now;
    }

    io.to(code).emit('timerUpdate', {
      whiteTime: room.whiteTime,
      blackTime: room.blackTime,
      turn: room.turn
    });

    if (room.whiteTime <= 0) {
      io.to(code).emit('gameOver', { winner: 'black', reason: 'White ran out of time' });
    }

    if (room.blackTime <= 0) {
      io.to(code).emit('gameOver', { winner: 'white', reason: 'Black ran out of time' });
    }
  }
}, 1000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
