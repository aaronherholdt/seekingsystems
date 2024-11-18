const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Your existing backend setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: 'https://seekingsystems.vercel.app', // Frontend domain for WebSocket
        methods: ['GET', 'POST']
    }
});

// Allow requests from your frontend's domain
app.use(cors({
    origin: 'https://seekingsystems.vercel.app', // Replace with your frontend domain
    methods: ['GET', 'POST'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    credentials: true // Include cookies if needed
}));

// Example route
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// Socket.IO logic
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('newPlayer', (data) => {
        console.log(`Player connected: ${data.name}`);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
