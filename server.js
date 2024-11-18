const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://127.0.0.1:5500", "https://seekingsystems.vercel.app"], // Add allowed origins
        methods: ["GET", "POST"]
    }
});

// Apply CORS middleware
app.use(cors({
    origin: ["http://127.0.0.1:5500", "https://seekingsystems.vercel.app"], // Add allowed origins
}));

let players = []; // Track connected players
let nodes = []; // To store all nodes
let connections = []; // To store connections between nodes
let scores = {}; // Player scores (keyed by player ID)
let resilience = 0; // Resilience timer

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player with a default name
    const newPlayer = { id: socket.id, name: `Player ${players.length + 1}` };
    players.push(newPlayer);
    io.emit("playerList", players); // Broadcast updated player list

    // Send initial game state to the newly connected player
    socket.emit("initializeGame", {
        nodes,
        connections,
        scores,
        resilience,
        players, // Send the players list
    });

    // Initialize the player's score
    scores[socket.id] = 0;
    io.emit("updateScores", scores); // Broadcast updated scores

    // Handle player disconnection
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove the player from the global players list
        players = players.filter(player => player.id !== socket.id);
        io.emit("playerList", players); // Broadcast updated player list

        // Remove the player's score
        delete scores[socket.id];
        io.emit("updateScores", scores); // Broadcast updated scores
    });

    // Handle node creation
    socket.on("createNode", (nodeData) => {
        const exists = nodes.some(node => node.id === nodeData.id);
        if (!exists) {
            nodes.push(nodeData); // Add the new node
            io.emit("nodeCreated", nodeData); // Broadcast the new node
        }
    });

    // Handle connection creation
    socket.on("createConnection", (connectionData) => {
        const exists = connections.some(
            (conn) =>
                (conn.node1 === connectionData.node1 &&
                    conn.node2 === connectionData.node2) ||
                (conn.node1 === connectionData.node2 &&
                    conn.node2 === connectionData.node1)
        );

        if (!exists) {
            connections.push(connectionData); // Add only if the connection is unique
            io.emit("connectionCreated", connectionData); // Broadcast the new connection
        }
    });

    // Handle player score updates
    socket.on("updateScore", ({ playerId, score }) => {
        scores[playerId] = score;
        io.emit("updateScores", scores); // Broadcast updated scores
    });

    // Handle resilience timer updates
    socket.on("updateResilience", (resilienceValue) => {
        resilience = resilienceValue;
        io.emit("updateResilience", resilience); // Broadcast updated resilience
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
