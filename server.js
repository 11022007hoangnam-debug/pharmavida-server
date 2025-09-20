const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// <<< NÂNG CẤP CUỐI CÙNG: Đơn giản hóa CORS và thêm log chi tiết >>>
app.use(cors()); // Sử dụng cấu hình CORS đơn giản nhất và hiệu quả nhất

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use((req, res, next) => {
    req.io = io;
    next();
});

const studentRoutes = require('./routes/student.routes');
const transactionRoutes = require('./routes/transaction.routes.js');
app.use('/api/students', studentRoutes);
app.use('/api/transactions', transactionRoutes);

// Thêm một route gốc để kiểm tra server có sống không
app.get('/', (req, res) => {
  res.send('Server is running and healthy!');
});


mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Đã kết nối thành công đến MongoDB Atlas!');
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối MongoDB:', err.message);
        process.exit(1);
    });

io.on('connection', (socket) => {
    console.log('✅ Một người dùng đã kết nối real-time.');
    socket.on('disconnect', () => {
        console.log('❌ Một người dùng đã ngắt kết nối real-time.');
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});