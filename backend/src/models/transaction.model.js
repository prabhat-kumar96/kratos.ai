import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    portfolio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    side: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    execution_price: {
        type: Number,
        required: true,
        min: 0
    },
    total_amount: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: false // Using timestamp field instead
});

// Make transactions immutable - prevent updates
transactionSchema.pre('save', function () {
    if (!this.isNew) {
        throw new Error('Transactions cannot be modified');
    }
});

// Index for querying transactions by portfolio
transactionSchema.index({ portfolio: 1, timestamp: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
