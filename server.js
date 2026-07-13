const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// Глобальное состояние комнаты
let gameState = {
    players: {},
    walls: [],       // Сохраняем стены на сервере
    fogOfWar: [],    // Сохраняем темноту на сервере
    currentMap: "default"
};

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);
    
    // Сразу отправляем новому игроку текущую карту, стены и темноту
    socket.emit('init-state', gameState);

    // Добавление игрока
    socket.on('join-game', (userData) => {
        gameState.players[socket.id] = {
            id: socket.id,
            name: userData.name || "Игрок",
            x: userData.x || 100,
            y: userData.y || 100,
            color: userData.color || "#ff0000",
            map: gameState.currentMap // Сажаем на текущую общую карту
        };
        io.emit('update-players', gameState.players);
    });

    // Движение и изменения от игрока
    socket.on('player-move', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            // Транслируем всем, кроме отправителя, для плавности
            socket.broadcast.emit('update-players', gameState.players);
        }
    });

    // Обновление стен (когда админ рисует/удаляет)
    socket.on('update-walls', (walls) => {
        gameState.walls = walls;
        socket.broadcast.emit('sync-walls', gameState.walls);
    });

    // Обновление тумана войны
    socket.on('update-fog', (fog) => {
        gameState.fogOfWar = fog;
        socket.broadcast.emit('sync-fog', gameState.fogOfWar);
    });

    // Перемещение игроков между картами (команда от ГМа)
    socket.on('change-map', (data) => {
        // data = { targetMap: "map_name", playerIds: [...] }
        if (data.playerIds && data.playerIds.length > 0) {
            data.playerIds.forEach(id => {
                if (gameState.players[id]) {
                    gameState.players[id].map = data.targetMap;
                }
            });
        } else {
            // Если id не переданы — переносим ВСЕХ
            gameState.currentMap = data.targetMap;
            Object.keys(gameState.players).forEach(id => {
                gameState.players[id].map = data.targetMap;
            });
        }
        io.emit('update-players', gameState.players);
        io.emit('sync-map', data.targetMap);
    });

    // Отключение
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        delete gameState.players[socket.id];
        io.emit('update-players', gameState.players);
    });
});

http.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});
