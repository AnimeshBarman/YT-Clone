import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const options = {
    httpOnly: true,
    secure: true
}

const generateAccessRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new apiError(500, 'Problem while generating Access and Refresh Token')
    }
}// returning accessToken and refreshToken


const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullname, password } = req.body
    // console.log('email:', email);

    if ([fullname, email, username, password].some((field) => field?.trim() === "")) {
        throw new apiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new apiError(409, "User with email or username alredy exists")
    }

    // console.log(req.files);

    // const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // console.log(req.findById.coverImage.path);
    // console.log(Array.isArray(req.files.coverImage));

    let avatarLocalPath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    // console.log(avatarLocalPath);
    // console.log(coverImageLocalPath);

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required..")
    }

    // if (!coverImageLocalPath) {
    //     throw new apiError(400, "Cover image file is required..")
    // }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new apiError(400, "Avatar file is required..")
    }

    // if (!coverImage) {
    //     throw new apiError(400, "Cover file is required..")
    // }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        // coverImage: coverImage.url,
        email,
        password,
        username
    })

    const cretedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!cretedUser) {
        throw new apiError(500, "Server error")
    }

    return await res.status(201).json(
        new apiResponse(200, cretedUser, "User registered successfully")
    )



})


const loginUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body

    if (!(email || username)) {
        throw new apiError(400, 'username or email is required')
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new apiError(404, 'User does not exist')
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new apiError(401, 'Password is invalid..')
    }

    const { accessToken, refreshToken } = await generateAccessRefreshTokens(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")



    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(200, {
                user: loggedUser, accessToken, refreshToken
            },
                "User logged is Successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {
            new: true
        }
    )


    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new apiResponse(200, {}, "User logged out successfully")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401, "Invalid refresh Token from refreshAccessToken controller")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is not same from refreshAccessToken controller")
        }
    
        const { accessToken, newRefreshToken } = await generateAccessRefreshTokens(user._id)
    
        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new apiError(401, error?.message || "invalid refresh token")
    }
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
};