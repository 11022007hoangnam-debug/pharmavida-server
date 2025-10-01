const express = require('express');
const router = express.Router();
const Student = require('../models/student.model');
const Transaction = require('../models/transaction.model');

// --- LẤY TẤT CẢ BỆNH NHÂN ---
router.get('/', async (req, res) => {
    try {
        const students = await Student.find();
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách bệnh nhân.' });
    }
});

// --- TÌM KIẾM BỆNH NHÂN ---
router.post('/search', async (req, res) => {
    try {
        const { fullName, biNumber } = req.body;
        if (!fullName && !biNumber) {
            return res.status(400).json({ message: 'Forneça o Nome ou o Nº de B.I para pesquisar.' });
        }
        
        let query = {};
        if (biNumber) {
            // Ưu tiên tìm bằng B.I vì nó là duy nhất
            query = { biNumber: biNumber };
        } else if (fullName) {
            // Tìm bằng tên (không phân biệt hoa thường)
            query = { fullName: new RegExp(`^${fullName}$`, 'i') };
        }

        const student = await Student.findOne(query);

        if (student) {
            res.status(200).json(student);
        } else {
            res.status(404).json({ message: 'Não foi encontrado nenhum registo no sistema, por favor entre em contacto com o administrador.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro de servidor ao pesquisar paciente.' });
    }
});

// --- (NÂNG CẤP) API GỢI Ý TÌM KIẾM (AUTOCOMPLETE) ---
router.get('/autocomplete', async (req, res) => {
    try {
        const term = req.query.term; // Lấy ký tự gõ từ query parameter 'term'

        if (!term) {
            // Nếu không có 'term', trả về mảng rỗng
            return res.json([]);
        }

        // Tạo một biểu thức chính quy (regex) để tìm kiếm tên có chứa 'term'
        // 'i' là để không phân biệt chữ hoa/thường
        const regex = new RegExp(term, 'i');

        // Tìm các bệnh nhân có tên khớp với regex, giới hạn 10 kết quả
        // và chỉ chọn trường fullName để gửi về cho nhẹ
        const students = await Student.find({ fullName: regex })
                                      .limit(10)
                                      .select('fullName');

        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi thực hiện tìm kiếm gợi ý.' });
    }
});


// --- TẠO MỘT BỆNH NHÂN MỚI ---
router.post('/', async (req, res) => {
    try {
        const { fullName, biNumber, phone, school, balance } = req.body;
        const io = req.io;

        const studentCount = await Student.countDocuments();
        if (studentCount >= 390) {
            return res.status(403).json({ message: 'O limite de 390 alunos foi atingido. Não é possível adicionar novos registos.' });
        }

        const existingStudent = await Student.findOne({ biNumber });
        if (existingStudent) {
            return res.status(400).json({ message: 'Este Nº de B.I já existe no sistema.' });
        }

        const newStudent = new Student({ fullName, biNumber, phone, school, balance });
        await newStudent.save();

        // <<< FIX REAL-TIME >>>: Gửi tín hiệu cho tất cả người dùng khi có bệnh nhân mới
        if(io) io.emit('dataUpdated', { message: `Um novo paciente foi adicionado: ${newStudent.fullName}` });
        
        res.status(201).json(newStudent);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi tạo bệnh nhân mới.', error: error.message });
    }
});

// --- CẬP NHẬT THÔNG TIN BỆNH NHÂN ---
router.put('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const updateData = req.body;
        const io = req.io;

        const updatedStudent = await Student.findByIdAndUpdate(studentId, updateData, { new: true });
        
        if (!updatedStudent) {
            return res.status(404).json({ message: 'Paciente não encontrado para atualizar.' });
        }

        // <<< FIX REAL-TIME >>>: Gửi tín hiệu khi thông tin (bao gồm cả số dư) được cập nhật
        if(io) io.emit('dataUpdated', { message: `As informações de ${updatedStudent.fullName} foram atualizadas.` });
        
        res.status(200).json(updatedStudent);
    } catch (error)
    {
        res.status(500).json({ message: 'Lỗi server khi cập nhật thông tin.', error: error.message });
    }
});

// --- XÓA MỘT BỆNH NHÂN ---
router.delete('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const io = req.io;

        await Transaction.deleteMany({ student: studentId });
        const deletedStudent = await Student.findByIdAndDelete(studentId);

        if (!deletedStudent) {
            return res.status(404).json({ message: 'Paciente não encontrado para eliminar.' });
        }

        // <<< FIX REAL-TIME >>>: Gửi tín hiệu khi một bệnh nhân bị xóa
        if(io) io.emit('dataUpdated', { message: `O registo de ${deletedStudent.fullName} foi eliminado.` });
        
        res.status(200).json({ message: 'Paciente e transações associadas foram eliminados com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi xóa bệnh nhân.', error: error.message });
    }
});

module.exports = router;