const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    service: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    newBalance: {
        type: Number,
        required: true
    },
    attendedBy: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true,
        // <<< NÂNG CẤP: Thêm 'Administração' vào danh sách các giá trị hợp lệ >>>
        enum: ['Centro Médico', 'Farmácia', 'Administração']
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;