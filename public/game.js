const socket = io();

let roomCode = '';
let myName = '';
let myRole = '';

function createRoom() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) return alert('Enter your name');

  myName = name;
  socket.emit('createRoom', { name }, (res) => {
    roomCode = res.code;
    myRole = 'player';
    document.getElementById('roomCode').innerText = 'Room Code: ' + roomCode;
  });
}

function joinRoom() {
  const name = document.getElementById('playerName').value.trim();
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!name || !code) return alert('Enter name and room code');

  myName = name;
  socket.emit('joinRoom', { code, name }, (res) => {
    if (res.error) return alert(res.error);
    roomCode = res.code;
    myRole = res.joined;
    document.getElementById('roomCode').innerText =
      'Room Code: ' + roomCode + ' (' + myRole + ')';
  });
}

socket.on('roomUpdate', (room) => {
  const players = room.players.map(p => p.name).join(' vs ');
  document.getElementById('players').innerText = players || 'Waiting for players...';
});

socket.on('lobbyUpdate', (data) => {
  const onlineCount = document.getElementById('onlineCount');
  const liveRooms = document.getElementById('liveRooms');

  if (onlineCount) {
    onlineCount.innerText = data.online;
  }

  if (liveRooms) {
    if (!data.rooms || data.rooms.length === 0) {
      liveRooms.innerText = 'No waiting matches';
      return;
    }

    liveRooms.innerText = '';

    data.rooms.forEach(room => {
      if (room.hostId === socket.id) return;

      const button = document.createElement('button');
      button.innerText = 'Join ' + room.host + "'s match";
      button.onclick = () => joinWaitingRoom(room.code);

      liveRooms.appendChild(button);
    });
  }
});

socket.on('move', (move) => {
  applyRemoteMove(move);
});

socket.on('chat', (data) => {
  addChat(data.name + ': ' + data.text);
});

socket.on('emote', (data) => {
  addChat(data.name + ' sent ' + data.emote);
});

function joinWaitingRoom(code) {
  const name = document.getElementById('playerName').value.trim();

  if (!name) return alert('Enter your name');

  socket.emit('joinWaitingRoom', { code, name }, (res) => {
    if (res.error) return alert(res.error);

    roomCode = res.code;
    myRole = res.joined;
  });
}

function sendMove(move) {
  if (myRole !== 'player') return;
  socket.emit('move', { code: roomCode, move });
}

function sendChat() {
  const text = document.getElementById('chatInput').value.trim();
  if (!text) return;
  socket.emit('chat', { code: roomCode, name: myName, text });
  document.getElementById('chatInput').value = '';
}

function sendEmote(emote) {
  socket.emit('emote', { code: roomCode, name: myName, emote });
}
