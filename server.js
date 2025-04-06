const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: ["http://a-malenkaya.ru"],
    methods: ["GET", "POST"]
  }
}););
app.use(express.static(__dirname));

// Константы игры
const GRID_WIDTH = 45; // 720/16
const GRID_HEIGHT = 30; // 480/16

// Состояние игры
let players = {};
let currentFood = {
    x: Math.floor(Math.random() * GRID_WIDTH),
    y: Math.floor(Math.random() * GRID_HEIGHT)
};

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Добавляем нового игрока
    players[socket.id] = {
        x: Math.floor(Math.random() * GRID_WIDTH),
        y: Math.floor(Math.random() * GRID_HEIGHT),
        playerId: socket.id
    };
    
    // Отправляем текущее состояние игры
    socket.emit('currentPlayers', players);
    socket.emit('foodPosition', currentFood);
    socket.broadcast.emit('newPlayer', players[socket.id]);
    
    // Обработчики событий
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
    
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y
            });
        }
    });
    
    socket.on('newFoodPosition', (newPos) => {
        if (newPos.x >= 0 && newPos.x < GRID_WIDTH && 
            newPos.y >= 0 && newPos.y < GRID_HEIGHT) {
            currentFood = newPos;
            io.emit('foodPosition', currentFood);
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Server ready at http://80.87.197.201:3000');
});