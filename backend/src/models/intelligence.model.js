import mongoose, { Schema } from "mongoose";

const intelligenceSchema = new Schema(
    {
        ticker: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            index: true
        },
        reliability_score: {
            type: Number,
            required: true
        },
        regime: {
            type: String,
            required: true
        },
        prediction: {
            type: Number,
            required: true
        },
        narrative_summary: {
            type: String
        },
        is_consistent: {
            type: Boolean,
            default: true
        },
        last_updated: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

export const Intelligence = mongoose.model("Intelligence", intelligenceSchema);
