const express = require('express');
const router = express.Router();
const Student = require('../models/student.model');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');

// ==========================================================
// THỨ TỰ ĐÚNG: CÁC ROUTE CỤ THỂ PHẢI ĐƯỢC ĐẶT TRƯỚC
// ==========================================================

// API ĐỂ LẤY GIAO DỊCH THEO NGÀY
router.get('/by-date', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Ngày là bắt buộc.' });
        }
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const transactions = await Transaction.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        })
        .sort({ createdAt: -1 })
        .populate('student', 'fullName');
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch theo ngày.', error: error.message });
    }
});

// API ĐỂ LẤY BÁO CÁO GIAO DỊCH
router.get('/report', async (req, res) => {
    try {
        const { startDate, endDate, department, school } = req.query; 

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Ngày bắt đầu và kết thúc là bắt buộc.' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        let query = {
            createdAt: { $gte: start, $lte: end }
        };

        if (department) {
            query.department = department;
        }
        
        if (school) {
            const studentsInSchool = await Student.find({ school: school }).select('_id');
            const studentIds = studentsInSchool.map(s => s._id);
            query.student = { $in: studentIds };
        }
        
        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .populate('student', 'fullName school');

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy báo cáo.', error: error.message });
    }
});

// ==========================================================
// ROUTE CHUNG CHUNG VỚI THAM SỐ ĐỘNG PHẢI ĐẶT Ở CUỐI CÙNG
// ==========================================================

// LẤY LỊCH SỬ GIAO DỊCH CỦA MỘT BỆNH NHÂN
router.get('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { startDate, endDate } = req.query;
        let query = { student: studentId };
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        }
        const transactions = await Transaction.find(query).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch.', error: error.message });
    }
});


// TẠO MỘT GIAO DỊCH MỚI
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { studentId, service, amount, attendedBy, department } = req.body;
        const io = req.io;
        
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            throw new Error('Paciente não encontrado.');
        }

        if (attendedBy !== 'Admin') {
            const existingTransaction = await Transaction.findOne({ student: studentId, service: service }).session(session);
            if (existingTransaction) {
                const invoiceNumber = service.trim();
                return res.status(409).json({
                    message: `Já existe uma transação com o número de fatura '${invoiceNumber}'. Por favor, verifique novamente antes de salvar.`
                });
            }
            if (student.balance < amount) {
                throw new Error('Saldo insuficiente para a transação.');
            }
        }

        const newBalance = student.balance - amount;
        student.balance = newBalance;
        await student.save({ session });

        const newTransaction = new Transaction({
            student: studentId, service, amount, newBalance,
            attendedBy, department
        });
        await newTransaction.save({ session });
        
        await session.commitTransaction();

        if (io) io.emit('dataUpdated', { message: `Nova transação para ${student.fullName}.` });
        res.status(201).json(newTransaction);

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: 'Erro ao criar transação.', error: error.message });
    } finally {
        session.endSession();
    }
});

// XÓA MỘT GIAO DỊCH
router.delete('/:id', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const io = req.io;

        // <<< NÂNG CẤP: Lấy thông tin từ header để xác định Chế độ Bảo trì >>>
        const isMaintenanceMode = req.headers['x-maintenance-mode'] === 'true';
        const adminPassword = process.env.ADMIN_PASSWORD; // Đọc trực tiếp từ .env
        const sentPassword = req.headers['x-admin-password'];
        
        // <<< NÂNG CẤP AN TOÀN: Chỉ cho phép override nếu mật khẩu admin tồn tại và khớp >>>
        const isAdminOverride = isMaintenanceMode && adminPassword && (sentPassword === adminPassword);

        const transactionToDelete = await Transaction.findById(id).session(session);
        if (!transactionToDelete) {
            throw new Error('Transação não encontrada.');
        }

        // <<< LOGIC KIỂM TRA MỚI >>>
        // Chỉ kiểm tra ngày tháng nếu KHÔNG ở trong Chế độ Bảo trì
        if (!isAdminOverride) {
            const transactionDate = new Date(transactionToDelete.createdAt);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (transactionDate < thirtyDaysAgo) {
                // Nếu giao dịch cũ hơn 30 ngày và không phải admin đang bảo trì -> CẤM
                throw new Error('Não é permitido eliminar transações com mais de 30 dias.');
            }
        }
        // Nếu là Admin Override, logic này sẽ được bỏ qua và đi tiếp

        const student = await Student.findById(transactionToDelete.student).session(session);
        if (student) {
            // Hoàn lại tiền cho bệnh nhân
            student.balance += transactionToDelete.amount;
            await student.save({ session });
        }

        await Transaction.findByIdAndDelete(id, { session });

        await session.commitTransaction();

        if (io) io.emit('dataUpdated', { message: `Transação para ${student ? student.fullName : ''} foi removida.` });
        res.status(200).json({ message: 'Transação eliminada e saldo do paciente atualizado com sucesso.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: 'Erro ao eliminar a transação.', error: error.message });
    } finally {
        session.endSession();
    }
});


module.exports = router;