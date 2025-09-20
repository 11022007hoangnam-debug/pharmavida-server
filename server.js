const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// <<< NÂNG CẤP CUỐI CÙNG: Cấu hình CORS chi tiết >>>
const allowedOrigins = [
    'http://127.0.0.1:5500', // Cho Live Server
    'http://localhost:5500'  // Cho Live Server (dự phòng)
];

const corsOptions = {
    origin: function (origin, callback) {
        // Cho phép các request không có origin (như file .exe sau này) và các origin trong danh sách
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

// Áp dụng cấu hình CORS cho các yêu cầu HTTP
app.use(cors(corsOptions));

// Cấu hình CORS cho Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Giữ nguyên '*' cho Socket.IO để linh hoạt
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