const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = []; // Track connected players

// Serve the frontend files
app.use(express.static(__dirname + '/public'));

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
