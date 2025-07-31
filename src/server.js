require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, transports: ['websocket', 'polling'] });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

// User credentials (for demonstration purposes)
const users = {
    'admin': { password: 'pass123' },
    'website owner': { password: 'pass123' },
    // Add more users as needed...
};

// Store messages and online users
const messages = [];
const onlineUsers = new Map();

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || !users[username] || users[username].password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, username });
});

// Middleware to authenticate WebSocket connections
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Invalid token'));
        socket.user = decoded; // Attach user info to socket
        next();
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    onlineUsers.set(socket.user.username, socket.id);
    io.emit('userPresence', Object.keys(users).map(u => ({ username: u, online: onlineUsers.has(u) })));

    socket.on('register', (data) => {
        socket.user.username = data.username;
        onlineUsers.set(data.username, socket.id);
        io.emit('userPresence', Object.keys(users).map(u => ({ username: u, online: onlineUsers.has(u) })));
    });

    socket.on('joinChat', (data) => {
        socket.join(data.username + '-' + data.target);
        socket.join(data.target + '-' + data.username);
    });

    socket.on('sendMessage', (message) => {
        const newMessage = {
            id: messages.length + 1,
            username: socket.user.username,
            text: message.text,
            timestamp: new Date().toISOString(),
            target: message.target,
            file: message.file || null
        };
        messages.push(newMessage);
        io.to(socket.user.username + '-' + message.target).emit('newMessage', newMessage);
        io.to(message.target + '-' + socket.user.username).emit('newMessage', newMessage);
    });

    socket.on('typing', (data) => {
        if (data.target) {
            io.to(data.target + '-' + data.username).emit('typing', { username: data.username, isTyping: data.isTyping });
        }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.user.username);
        io.emit('userPresence', Object.keys(users).map(u => ({ username: u, online: onlineUsers.has(u) })));
    });
});

// Start the server
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
