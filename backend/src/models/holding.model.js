import mongoose from 'mongoose';

const holdingSchema = new mongoose.Schema({
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
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    average_buy_price: {
        type: Number,
        required: true,
        min: 0
    },
    total_cost: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for portfolio + symbol (unique combination)
holdingSchema.index({ portfolio: 1, symbol: 1 }, { unique: true });

// Virtual for current value (will be calculated with live price)
holdingSchema.virtual('current_value').get(function () {
    return this.quantity * this.current_price || 0;
});

// Virtual for unrealized P&L
holdingSchema.virtual('unrealized_pnl').get(function () {
    if (!this.current_price) return 0;
    return (this.current_price * this.quantity) - this.total_cost;
});

export const Holding = mongoose.model('Holding', holdingSchema);
