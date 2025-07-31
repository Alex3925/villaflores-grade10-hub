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

const users = {
    'admin': { password: 'pass123' }, 'website owner': { password: 'pass123' },
    'user1': { password: 'pass123' }, 'user2': { password: 'pass123' }, 'user3': { password: 'pass123' },
    'user4': { password: 'pass123' }, 'user5': { password: 'pass123' }, 'user6': { password: 'pass123' },
    'user7': { password: 'pass123' }, 'user8': { password: 'pass123' }, 'user9': { password: 'pass123' },
    'user10': { password: 'pass123' }, 'user11': { password: 'pass123' }, 'user12': { password: 'pass123' },
    'user13': { password: 'pass123' }, 'user14': { password: 'pass123' }, 'user15': { password: 'pass123' },
    'user16': { password: 'pass123' }, 'user17': { password: 'pass123' }, 'user18': { password: 'pass123' },
    'user19': { password: 'pass123' }, 'user20': { password: 'pass123' }, 'user21': { password: 'pass123' },
    'user22': { password: 'pass123' }, 'user23': { password: 'pass123' }, 'user24': { password: 'pass123' },
    'user25': { password: 'pass123' }, 'user26': { password: 'pass123' }, 'user27': { password: 'pass123' },
    'user28': { password: 'pass123' }, 'user29': { password: 'pass123' }, 'user30': { password: 'pass123' },
    'user31': { password: 'pass123' }, 'user32': { password: 'pass123' }, 'user33': { password: 'pass123' },
    'user34': { password: 'pass123' }, 'user35': { password: 'pass123' }, 'user36': { password: 'pass123' },
    'user37': { password: 'pass123' }, 'user38': { password: 'pass123' }, 'user39': { password: 'pass123' },
    'user40': { password: 'pass123' }, 'user41': { password: 'pass123' }, 'user42': { password: 'pass123' },
    'user43': { password: 'pass123' }, 'user44': { password: 'pass123' }, 'user45': { password: 'pass123' },
    'user46': { password: 'pass123' }, 'user47': { password: 'pass123' }, 'user48': { password: 'pass123' },
    'user49': { password: 'pass123' }, 'user50': { password: 'pass123' }, 'user51': { password: 'pass123' },
    'user52': { password: 'pass123' }, 'user53': { password: 'pass123' }, 'user54': { password: 'pass123' },
    'user55': { password: 'pass123' }, 'user56': { password: 'pass123' }, 'user57': { password: 'pass123' },
    'user58': { password: 'pass123' }
};

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

server.listen(port, () => console.log(`Server at http://localhost:${port}`));
