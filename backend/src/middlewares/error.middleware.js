import mongoose from "mongoose";
import { ApiError } from '../utils/ApiError.js';

// Global Error Handler Middleware
const errorMiddleware = (err, req, res, next) => {
    let error = err;

    // If it's not an ApiError, wrap it
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || error instanceof mongoose.Error ? 400 : 500;
        const message = error.message || "Something went wrong";
        error = new ApiError(statusCode, message, error?.errors || [], error.stack);
    }

    const response = {
        ...error,
        message: error.message,
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {})
    };

    // Send formatted JSON response
    return res.status(error.statusCode || 500).json(response);
};


export { errorMiddleware };
