require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const users = [
    { id: 1, username: 'admin', email: 'admin@villaflorescollege.edu.ph', password: 'password123' },
    { id: 2, username: 'student', email: 'student@villaflorescollege.edu.ph', password: 'student456' }
];

const messages = [];

const JWT_SECRET = process.env.JWT_SECRET || '=3f9aG7bXzKpQwRtYcL2mN8vJ4hDxS5uW6tEyH1oPqZ0=';

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.find(
        u => (u.username === username || u.email === username) && u.password === password
    );

    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, username: user.username });
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected`);

    socket.emit('initialMessages', messages.slice(-10));

    socket.on('sendMessage', (message) => {
        const newMessage = {
            id: messages.length + 1,
            username: socket.user.username,
            text: message.text,
            timestamp: new Date().toISOString(),
            file: message.file || null
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

    socket.on('disconnect', () => {
        console.log(`User ${socket.user.username} disconnected`);
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
