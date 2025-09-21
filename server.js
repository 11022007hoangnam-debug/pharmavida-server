// server.js (PHIÊN BẢN CHẨN ĐOÁN)
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

// --- BẮT ĐẦU PHẦN MÃ CHẨN ĐOÁN ---
console.log('---[ BẮT ĐẦU KIỂM TRA BIẾN MÔI TRƯỜNG ]---');
console.log('Giá trị của process.env.PORT:', process.env.PORT);
console.log('Giá trị của process.env.MONGODB_URI:', process.env.MONGODB_URI);
console.log('---[ KẾT THÚC KIỂM TRA BIẾN MÔI TRƯỜNG ]---\n');
// --- KẾT THÚC PHẦN MÃ CHẨN ĐOÁN ---

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    req.io = io;
    next();
});

const studentRoutes = require('./routes/student.routes');
const transactionRoutes = require('./routes/transaction.routes.js');
app.use('/api/students', studentRoutes);
app.use('/api/transactions', transactionRoutes);

// Tạm thời vô hiệu hóa kết nối DB để xem log
/*
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Đã kết nối thành công đến MongoDB Atlas!');
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối MongoDB:', err.message);
        process.exit(1);
    });
*/

io.on('connection', (socket) => {
    console.log('✅ Một người dùng đã kết nối real-time.');
    socket.on('disconnect', () => {
        console.log('❌ Một người dùng đã ngắt kết nối real-time.');
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
    // Thêm một dòng log để xác nhận server vẫn sống sau khi kiểm tra
    console.log('Server vẫn đang hoạt động sau khi kiểm tra biến môi trường.');
});