const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = []; // Track connected players

// Serve static files for the frontend
app.use(express.static("public")); // Replace "public" with your directory for frontend files

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player
    socket.on("newPlayer", (playerData) => {
        players.push({ id: socket.id, name: playerData.name });
        io.emit("playerList", players); // Broadcast updated player list
    });

    // Remove player on disconnect
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        players = players.filter(player => player.id !== socket.id);
        io.emit("playerList", players); // Broadcast updated player list
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
