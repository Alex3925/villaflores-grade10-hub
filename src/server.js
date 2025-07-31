require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'] // Prefer WebSocket
});
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const users = [
    { id: 1, username: 'admin', email: 'admin@villaflorescollege.edu.ph', password: 'password123' },
    { id: 2, username: 'student', email: 'student@villaflorescollege.edu.ph', password: 'student456' }
];

const messages = [];
const onlineUsers = new Map();

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        console.log('Login failed: Missing username or password');
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.find(
        u => (u.username === username || u.email === username) && u.password === password
    );

    if (!user) {
        console.log('Login failed: Invalid credentials for', username);
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for', username, 'Token:', token);
    res.json({ message: 'Login successful', token, username: user.username });
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        console.log('Socket auth failed: No token provided');
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        console.log('Socket auth successful for', decoded.username);
        next();
    } catch (err) {
        console.log('Socket auth failed:', err.message);
        next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected, socket ID: ${socket.id}`);
    onlineUsers.set(socket.user.username, socket.id);
    io.emit('userPresence', users.map(u => ({
        username: u.username,
        online: onlineUsers.has(u.username)
    })));

    socket.emit('initialMessages', messages.slice(-10));

    socket.on('sendMessage', (message) => {
        const newMessage = {
            id: messages.length + 1,
            username: socket.user.username,
            text: message.text,
            timestamp: new Date().toISOString(),
            file: message.file || null,
            reactions: {}
        };
        messages.push(newMessage);
        io.emit('newMessage', newMessage);
    });

    socket.on('deleteMessage', (messageId) => {
        if (socket.user.username === 'admin') {
            const index = messages.findIndex(m => m.id === parseInt(messageId));
            if (index !== -1) {
                messages.splice(index, 1);
                io.emit('updateMessages', messages.slice(-10));
            }
        }
    });

    socket.on('typing', (data) => {
        if (data.isTyping) {
            socket.broadcast.emit('typing', { username: data.username });
        }
    });

    socket.on('addReaction', (data) => {
        const message = messages.find(m => m.id === data.messageId);
        if (message) {
            if (!message.reactions[data.emoji]) {
                message.reactions[data.emoji] = [];
            }
            if (!message.reactions[data.emoji].includes(data.username)) {
                message.reactions[data.emoji].push(data.username);
                io.emit('reactionUpdate', message);
            }
        }
    });

    socket.on('offer', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('offer', {
                offer: data.offer,
                sender: socket.user.username,
                target: data.target
            });
            console.log(`Offer sent from ${socket.user.username} to ${data.target}`);
        } else {
            console.log(`Target user ${data.target} not found`);
        }
    });

    socket.on('answer', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('answer', {
                answer: data.answer,
                target: data.target
            });
            console.log(`Answer sent to ${data.target}`);
        }
    });

    socket.on('ice-candidate', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', {
                candidate: data.candidate,
                target: data.target
            });
            console.log(`ICE candidate sent to ${data.target}`);
        }
    });

    socket.on('end-call', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('end-call', { target: data.target });
            console.log(`End call sent to ${data.target}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.user.username} disconnected`);
        onlineUsers.delete(socket.user.username);
        io.emit('userPresence', users.map(u => ({
            username: u.username,
            online: onlineUsers.has(u.username)
        })));
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
