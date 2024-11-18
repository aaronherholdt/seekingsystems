const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://127.0.0.1:5500", "https://your-frontend-domain.com"], // Add allowed origins
        methods: ["GET", "POST"]
    }
});

// Apply CORS middleware
app.use(cors({
    origin: ["https://seekingsystems.vercel.app"], // Add allowed origins
}));

let players = []; // Track connected players

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
