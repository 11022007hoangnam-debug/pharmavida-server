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
        enum: ['Centro Médico', 'Farmácia']
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;