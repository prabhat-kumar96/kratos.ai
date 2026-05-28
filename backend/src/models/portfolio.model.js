import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    initial_capital: {
        type: Number,
        required: true,
        min: 1000
    },
    cash_balance: {
        type: Number,
        required: true,
        min: 0
    },
    is_active: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index to enforce one active portfolio per user
portfolioSchema.index({ user: 1, is_active: 1 }, { unique: true, partialFilterExpression: { is_active: true } });

export const Portfolio = mongoose.model('Portfolio', portfolioSchema);
