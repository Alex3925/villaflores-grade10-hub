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
app.use(express.static('public'));

const users = [
    'admin', 'website owner', 'user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8',
    'user9', 'user10', 'user11', 'user12', 'user13', 'user14', 'user15', 'user16', 'user17', 'user18',
    'user19', 'user20', 'user21', 'user22', 'user23', 'user24', 'user25', 'user26', 'user27', 'user28',
    'user29', 'user30', 'user31', 'user32', 'user33', 'user34', 'user35', 'user36', 'user37', 'user38',
    'user39', 'user40', 'user41', 'user42', 'user43', 'user44', 'user45', 'user46', 'user47', 'user48',
    'user49', 'user50', 'user51', 'user52', 'user53', 'user54', 'user55', 'user56', 'user57', 'user58'
].reduce((map, u) => (map[u] = { password: 'pass123' }, map), {});

const messages = [];
const onlineUsers = new Map();

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || !users[username] || users[username].password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, username });
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => err ? next(new Error('Invalid token')) : (socket.user = decoded, next()));
});

io.on('connection', (socket) => {
    onlineUsers.set(socket.user.username, socket.id);
    io.emit('userPresence', users.map(u => ({ username: u, online: onlineUsers.has(u) })));

    socket.emit('initialMessages', messages.filter(m => m.category === 'schoolWorks').slice(-10));

    socket.on('register', (data) => {
        socket.user.username = data.username;
        onlineUsers.set(data.username, socket.id);
        io.emit('userPresence', users.map(u => ({ username: u, online: onlineUsers.has(u) })));
    });

    socket.on('sendMessage', (message) => {
        const newMessage = { ...message, username: socket.user.username, timestamp: new Date().toISOString(), category: message.category || 'schoolWorks' };
        messages.push(newMessage);
        io.emit('newMessage', newMessage);
    });

    socket.on('offer', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) io.to(targetSocketId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) io.to(targetSocketId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        const targetSocketId = onlineUsers.get(data.target);
        if (targetSocketId) io.to(targetSocketId).emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.user.username);
        io.emit('userPresence', users.map(u => ({ username: u, online: onlineUsers.has(u) })));
    });
});

server.listen(port, () => console.log(`Server at http://localhost:${port}`));
