import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)  //user is an object and has all the properties
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        //we give the access token to the user , but store refresh token in db also
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })  // we dont want to run all the validations again while saving refresh token , see from schema

        return { accessToken, refreshToken }


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    // 1. Get user details from request body
    const { username, email, password, role, companyName } = req.body;

    // 2. Basic Validation
    if (
        [username, email, password, role].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Username, Email, Password, and Role are required");
    }

    // 3. Conditional Validation: Founders MUST have a Company Name
    if (role === 'founder' && (!companyName || companyName.trim() === "")) {
        throw new ApiError(400, "Company Name is required for Founders");
    }

    // 4. Check if user already exists
    // CHANGED: We now check if EITHER the email OR the username exists
    const existedUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with this email or username already exists");
    }

    // 5. Create User Object
    const user = await User.create({
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password,
        role,
        companyName: companyName ? companyName.trim() : ""
    });

    // 6. Return Response (exclude password & refresh token)
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    );
});


const loginUser = asyncHandler(async (req, res) => {
    // 1. Get data from body
    // We allow login via either Username OR Email
    const { email, username, password } = req.body;

    // 2. Validation
    if (!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

    // 3. Find User
    // We use $or to check both fields. 
    const user = await User.findOne({
        $or: [
            username ? { username: username.trim().toLowerCase() } : null,
            email ? { email: email.trim().toLowerCase() } : null
        ].filter(Boolean) // Remove nulls to avoid invalid query
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // 4. Password Check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // 5. Generate Tokens
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

    // 6. Fetch User for Response (sanitize sensitive fields)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // 7. Set Cookie Options
    const options = {
        httpOnly: true,
        secure: true
    };

    // 8. Send Response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    // 1. Update Database: Remove the Refresh Token
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    );

    // 2. Clear Cookies
    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    // 1. Get Token from Cookie OR Body (Mobile apps often use body)
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // 2. Verify the Token (Decrypt it)
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        // 3. Find the User associated with this token
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // 4. Security Check: Token Rotation
        // The token sent by user MUST match the one stored in DB.
        // If they don't match, it means the token was reused or user logged out elsewhere.
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        // 5. Generate NEW Set of Tokens
        // This rotates the Refresh Token (issues a fresh one and updates DB)
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshTokens(user._id);

        const options = {
            httpOnly: true,
            secure: true
        };

        // 6. Send Response with NEW tokens
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options) // Update the cookie
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            );

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const googleAuth = asyncHandler(async (req, res) => {
    const { credential } = req.body; // Google ID Token

    try {
        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        const { email, name, sub: googleId } = payload;

        // 1. Check if user exists
        let user = await User.findOne({
            $or: [{ email }, { googleId }]
        });

        if (!user) {
            // 2. Create new user if not exists
            // Generate a random username if name is taken? Or just use name/email part.
            // Simple strategy: use email prefix + random number
            const baseUsername = email.split('@')[0];
            const randomSuffix = Math.floor(Math.random() * 10000);
            const username = `${baseUsername}${randomSuffix}`;

            user = await User.create({
                username: username.toLowerCase(),
                email,
                googleId,
                role: "investor", // Default role
                // password: "" // No password for Google Auth users
            });
        } else if (!user.googleId) {
            // Link Google Account to existing account
            user.googleId = googleId;
            await user.save({ validateBeforeSave: false });
        }

        // 3. Generate Tokens (Same as Login)
        const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser,
                        accessToken,
                        refreshToken
                    },
                    "Google Login successful"
                )
            );

    } catch (error) {
        console.error("Google Auth Error:", error);
        throw new ApiError(401, "Google Authentication failed");
    }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken, googleAuth }




