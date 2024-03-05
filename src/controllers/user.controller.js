import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js'
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


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
} //returning accessToken and refreshToken


const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullname, password } = req.body

    if ([fullname, email, username, password].some((field) => field?.trim() === "")) {
        throw new apiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new apiError(409, "User with email or username alredy exists")
    }


    let coverImageLocalPath
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

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
        avatar: {
            url: avatar.url,
            public_id: avatar.public_id
        },
        // coverImage: {
        // url: coverImage.url,
        // public_id: coverImage.public_id
        // },
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
            $unset: {
                refreshToken: 1,
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


const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user._id)

    const correctPassword = await user.isPasswordCorrect(oldPassword)

    if (!correctPassword) {
        throw new apiError(400, "Invalid old password from changePassword controller")
    }

    user.password = newPassword;

    await user.save({
        validateBeforeSave: false
    })

    return res
        .status(200)
        .json(
            new apiResponse(200, {}, "Password changed successfully")
        )
})


const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new apiResponse(200, req.user, "Current user fetched successfully")
        )
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body

    if (!fullname || !email) {
        throw new apiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(
            new apiResponse(200, user, "Account details updated successfully")
        )
})


const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    //TODO: delete old avatar -- assignment.....

    if (!avatar.url) {
        throw new apiError(400, "Error while uploading Avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    if (!user) {
        throw new apiError(500, "Problem while updating avatar file")
    }

    await deleteFromCloudinary(avatar.public_id, "image")

    return res
        .status(200)
        .json(
            new apiResponse(200, user, "Avatar updated successfully")
        )
})


const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new apiError(400, "Error while uploading coverImage")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    await deleteFromCloudinary(coverImage.public_id, "image")


    return res
        .status(200)
        .json(
            new apiResponse(200, user, "Cover image updated successfully")
        )
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new apiError(400, "username is missing from req.params")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new apiError(400, "channel does not exist")
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, channel[0], "User fetched successfully")
        )
})


const getWatchHistory = asyncHandler(async (req, res) => {
    
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new apiResponse(200, user[0].watchHistory, "Watch History fetched successfully")
        )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
};