const express = require('express');
const cors = require('cors');
const app = express();

// Allow requests from your frontend's domain
app.use(cors({
    origin: 'https://seekingsystems.vercel.app', // Replace with your frontend domain
    methods: ['GET', 'POST'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    credentials: true // Include cookies if needed
}));

// Your existing backend setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: 'https://seekingsystems.vercel.app', // Frontend domain for WebSocket
        methods: ['GET', 'POST']
    }
});

// Example route
app.get('/', (req, res) => {
    res.send('Backend is running');
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
