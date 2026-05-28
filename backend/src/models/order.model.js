import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    portfolio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    order_type: {
        type: String,
        enum: ['MARKET', 'LIMIT'],
        default: 'MARKET',
        required: true
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
    limit_price: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED'],
        default: 'PENDING',
        required: true
    },
    filled_quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    average_fill_price: {
        type: Number,
        min: 0
    },
    total_amount: {
        type: Number,
        default: 0
    },
    executed_at: {
        type: Date
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for querying orders by portfolio and status
orderSchema.index({ portfolio: 1, status: 1 });

export const Order = mongoose.model('Order', orderSchema);
