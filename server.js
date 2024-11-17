const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = []; // Array to store connected players

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on("newPlayer", (playerData) => {
        players.push({ id: socket.id, name: playerData.name });
        io.emit("playerList", players); // Broadcast updated player list
    });

    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        players = players.filter((player) => player.id !== socket.id);
        io.emit("playerList", players); // Broadcast updated player list
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
