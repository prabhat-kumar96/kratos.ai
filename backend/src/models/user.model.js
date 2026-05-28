import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"


const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ["founder", "investor", "admin"],
            default: "founder"
        },
        companyName: {
            type: String,
            trim: true,
            default: ""
            // Note: We don't make it 'required: true' in the schema 
            // because we handle that logic in the controller (it depends on the role).
        },
        password: {
            type: String,
            // required: [true, 'Password is required'] 
            // Made optional for Google Auth users. We handle validation in controller.
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true // Allows null/undefined values to not violate uniqueness
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
)


userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)  //returns true or false , compares plain password with hashed password
}



userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,               //since already in database, we can use this._id
            email: this.email,
            username: this.username,
            role: this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,

        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema)