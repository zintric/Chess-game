const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }, cb) => {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    rooms[code] = {
      code,
      players: [{ id: socket.id, name }],
      spectators: [],
      moves: [],
      chat: [],
      status: 'waiting'
    };
    socket.join(code);
    cb({ code });
  });

  socket.on('joinRoom', ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found' });

    if (room.players.length < 2) {
      room.players.push({ id: socket.id, name });
      socket.join(code);
      cb({ joined: 'player', code });
    } else {
      room.spectators.push({ id: socket.id, name });
      socket.join(code);
      cb({ joined: 'spectator', code });
    }

    io.to(code).emit('roomUpdate', room);
  });

  socket.on('move', ({ code, move }) => {
    const room = rooms[code];
    if (!room) return;
    room.moves.push(move);
    io.to(code).emit('move', move);
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
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
