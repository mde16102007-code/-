const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Единое состояние игры на сервере (сохраняется, пока сервер запущен)
let gameState = {
    tiles: [], // Массив всех тайлов на карте
    gmId: null // ID игрока-Мастера
};

app.use(express.static(path.join(__dirname)));

wss.on('connection', (ws) => {
    // Назначаем уникальный ID клиенту
    ws.id = Math.random().toString(36).substring(2, 9);
    
    // Если Мастера еще нет, первый подключившийся становится Мастером
    if (!gameState.gmId) {
        gameState.gmId = ws.id;
        ws.isGm = true;
    } else {
        ws.isGm = false;
    }

    // Отправляем новому игроку текущее состояние карты и его роль
    ws.send(JSON.stringify({
        type: 'INIT',
        tiles: gameState.tiles,
        isGm: ws.isGm,
        id: ws.id
    }));

    // Обработка входящих сообщений
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'ADD_TILE') {
                // Проверяем: только Мастер может добавлять новые тайлы
                if (!ws.isGm) return; 
                gameState.tiles.push(message.tile);
                broadcast({ type: 'UPDATE_TILES', tiles: gameState.tiles });
            } 
            else if (message.type === 'MOVE_TILE') {
                // Проверяем доступ: двигать могут только Мастер или тот, кому разрешено
                const tile = gameState.tiles.find(t => t.id === message.tileId);
                if (tile && (ws.isGm || tile.allowedUsers?.includes(ws.id))) {
                    tile.x = message.x;
                    tile.y = message.y;
                    broadcast({ type: 'UPDATE_TILES', tiles: gameState.tiles });
                }
            }
            else if (message.type === 'SYNC_ALL') {
                // Полное обновление карты (если Мастер загружает/перезаписывает всё)
                if (!ws.isGm) return;
                gameState.tiles = message.tiles || [];
                broadcast({ type: 'UPDATE_TILES', tiles: gameState.tiles });
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });

    ws.on('close', () => {
        if (ws.id === gameState.gmId) {
            gameState.gmId = null; // Если Мастер вышел, освобождаем роль
        }
    });
});

function broadcast(data) {
    const json = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
