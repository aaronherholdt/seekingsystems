const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://seekingsystems.vercel.app/", // Adjust to your frontend's URL for better security
    methods: ["GET", "POST"],
  },
});

// Middleware to serve static files (Optional if you serve frontend separately)
app.use(express.static("public"));

// Handle basic route for backend testing
app.get("/", (req, res) => {
  res.send("Backend is running and ready for connections!");
});

// Track connected players
let players = [];

// Handle socket connections
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle a new player joining
  socket.on("newPlayer", (data) => {
    const playerName = data.name || "Anonymous"; // Fallback name
    players.push({ id: socket.id, name: playerName });
    console.log(`New player added: ${playerName}`);
    io.emit("playerList", players); // Broadcast updated player list
  });

  // Handle player disconnection
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    players = players.filter((player) => player.id !== socket.id);
    io.emit("playerList", players); // Broadcast updated player list
  });
});

// Set up the server to listen on a specific port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
