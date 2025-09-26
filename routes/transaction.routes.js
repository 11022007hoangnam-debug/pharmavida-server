const express = require('express');
const router = express.Router();
const Student = require('../models/student.model');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');

// <<< NÂNG CẤP MỚI: API ĐỂ LẤY GIAO DỊCH THEO NGÀY (FIX LỖI) >>>
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
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        })
        .sort({ createdAt: -1 })
        .populate('student', 'fullName'); // Lấy thêm thông tin tên của bệnh nhân

        res.status(200).json(transactions);

    } catch (error) {
        // Thay đổi thông báo lỗi để rõ ràng hơn
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch theo ngày.', error: error.message });
    }
});


// API ĐỂ LẤY BÁO CÁO GIAO DỊCH
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
        
        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .populate('student', 'fullName school');

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy báo cáo.', error: error.message });
    }
});

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

// TẠO MỘT GIAO DỊCH MỚI
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { studentId, service, amount, attendedBy, department } = req.body;
        const io = req.io;

        const existingTransaction = await Transaction.findOne({ student: studentId, service: service }).session(session);
        if (existingTransaction) {
            const invoiceNumber = service.trim();
            return res.status(409).json({
                message: `Já existe uma transação com o número de fatura '${invoiceNumber}'. Por favor, verifique novamente antes de salvar.`
            });
        }

        const student = await Student.findById(studentId).session(session);
        if (!student) {
            throw new Error('Paciente não encontrado.');
        }
        if (student.balance < amount) {
            throw new Error('Saldo insuficiente para a transação.');
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

        const transactionToDelete = await Transaction.findById(id).session(session);
        if (!transactionToDelete) {
            throw new Error('Transação não encontrada.');
        }

        const student = await Student.findById(transactionToDelete.student).session(session);
        if (student) {
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