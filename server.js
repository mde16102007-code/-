const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище состояния игры на сервере
let gameState = {
    map: null,
    tiles: [],
    hostId: null
};

app.use(express.static(path.join(__dirname)));

wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(2, 9);
    
    // Первый подключившийся становится Мастером (Хостом)
    let isHost = false;
    if (!gameState.hostId) {
        gameState.hostId = clientId;
        isHost = true;
    }

    // Отправляем текущее состояние новому клиенту
    ws.send(JSON.stringify({
        type: 'init',
        clientId: clientId,
        isHost: isHost,
        state: gameState
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'set_map' && data.isHost) {
                gameState.map = data.mapData;
            } else if (data.type === 'add_tile' && data.isHost) {
                gameState.tiles.push(data.tile);
            } else if (data.type === 'move_tile') {
                const tile = gameState.tiles.find(t => t.id === data.id);
                if (tile) {
                    // Проверяем права: двигать может либо хост, либо игрок с доступом
                    if (data.isHost || (tile.allowed && tile.allowed.includes(data.clientId))) {
                        tile.x = data.x;
                        tile.y = data.y;
                    }
                }
            } else if (data.type === 'update_permission' && data.isHost) {
                const tile = gameState.tiles.find(t => t.id === data.id);
                if (tile) {
                    tile.allowed = data.allowed; // Массив ID игроков, которым разрешено
                }
            } else if (data.type === 'delete_tile' && data.isHost) {
                gameState.tiles = gameState.tiles.filter(t => t.id !== data.id);
            }

            // Рассылаем обновленное состояние всем
            broadcastState();
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        if (gameState.hostId === clientId) {
            gameState.hostId = null; // Если мастер вышел, слот освобождается
        }
    });
});

function broadcastState() {
    const dataString = JSON.stringify({
        type: 'state_update',
        state: gameState
    });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(dataString);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
