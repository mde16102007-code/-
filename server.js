const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Раздаем статические файлы (включая ваш index.html в той же папке)
app.use(express.static(path.join(__dirname)));

// Обработка сетевых подключений игроков
wss.on('connection', (ws) => {
    console.log('Игрок подключился к сессии');

    ws.on('message', (message) => {
        // Рассылаем сообщение (ход, действие, изменения) всем участникам игры
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    ws.on('close', () => {
        console.log('Игрок покинул сессию');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
