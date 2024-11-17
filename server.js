const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Configure CORS to allow requests from the frontend origin
const io = new Server(server, {
  cors: {
    origin: "https://seekingsystems.vercel.app", // Replace with your frontend URL
    methods: ["GET", "POST"],
    credentials: true, // Allow cookies if needed
  },
});

// Middleware to handle CORS for other API routes
app.use(cors({
  origin: "https://seekingsystems.vercel.app", // Replace with your frontend URL
  methods: ["GET", "POST"],
}));

let players = []; // Track connected players

// Handle new connections
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle a new player joining
  socket.on("newPlayer", (data) => {
    players.push({ id: socket.id, name: data.name });
    io.emit("playerList", players); // Broadcast the updated player list
  });

  // Handle a player disconnecting
  socket.on("disconnect", () => {
    players = players.filter((player) => player.id !== socket.id);
    io.emit("playerList", players); // Broadcast the updated player list
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
