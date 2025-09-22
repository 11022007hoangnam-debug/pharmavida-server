const express = require('express');
const router = express.Router();
const Student = require('../models/student.model');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');

// <<< NÂNG CẤP: API ĐỂ LẤY BÁO CÁO GIAO DỊCH >>>
router.get('/report', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Ngày bắt đầu và kết thúc là bắt buộc.' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        let query = {
            createdAt: {
                $gte: start,
                $lte: end
            }
        };

        if (department) {
            query.department = department;
        }

        // ======================= FIX HERE =======================
        // Thêm .populate() để lấy thông tin 'fullName' và 'school' từ model Student
        // Dựa trên mã nguồn của bạn, trường liên kết là 'student'
        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .populate('student', 'fullName school');
        // ========================================================

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy báo cáo.', error: error.message });
    }
});

// --- LẤY LỊCH SỬ GIAO DỊCH CỦA MỘT BỆNH NHÂN ---
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

            query.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        const transactions = await Transaction.find(query).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch.', error: error.message });
    }
});

// --- TẠO MỘT GIAO DỊCH MỚI ---
router.post('/', async (req, res) => {
    try {
        const { studentId, service } = req.body;

        const existingTransaction = await Transaction.findOne({ student: studentId, service: service });

        if (existingTransaction) {
            const invoiceNumber = service.trim();
            return res.status(409).json({
                message: `Já existe uma transação com o número de fatura '${invoiceNumber}'. Por favor, verifique novamente antes de salvar.`
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { amount, attendedBy, department } = req.body;
            const io = req.io;

            const student = await Student.findById(studentId).session(session);
            if (!student) {
                throw new Error('Paciente não encontrado.');
            }

            if (student.balance < amount) {
                throw new Error('Saldo insuficiente para a transação.');
            }

            const newBalance = student.balance - amount;

            const newTransaction = new Transaction({
                student: studentId, service, amount, newBalance,
                attendedBy, department
            });

            await newTransaction.save({ session });
            
            student.balance = newBalance;
            await student.save({ session });
            
            await session.commitTransaction();

            if (io) io.emit('dataUpdated', { message: `Nova transação para ${student.fullName}.` });
            res.status(201).json(newTransaction);

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar transação.', error: error.message });
    }
});

module.exports = router;