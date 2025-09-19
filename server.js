const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Middleware để inject `io` vào mỗi request
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
const studentRoutes = require('./routes/student.routes');
const transactionRoutes = require('./routes/transaction.routes.js');
app.use('/api/students', studentRoutes);
app.use('/api/transactions', transactionRoutes);

// Kết nối đến MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Đã kết nối thành công đến MongoDB Atlas!');
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối MongoDB:', err.message);
        process.exit(1);
    });

// Kết nối Real-time (Socket.IO)
io.on('connection', (socket) => {
    console.log('✅ Một người dùng đã kết nối real-time.');
    socket.on('disconnect', () => {
        console.log('❌ Một người dùng đã ngắt kết nối real-time.');
    });
});

// Khởi động server
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});