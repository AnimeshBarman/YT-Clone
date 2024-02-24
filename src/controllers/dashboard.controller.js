import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"

const getChannelStats = asyncHandler(async (req, res) => {

    const userId = req.user._id

    const totalSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $count: "totalSubscribers"
        }
    ])

    if (!totalSubscribers || totalSubscribers?.length === 0) {
        throw new apiError(404, "Subscribers not found")
    }

    const totalVideos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
                isPublished: true
            }
        },
        {
            $count: "totalVideos"
        }
    ])

    if (!totalVideos || totalVideos?.length === 0) {
        throw new apiError(404, "Videos not found")
    }

    const totalViews = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null, // group all the docs into one
                totalViews: {
                    $sum: "$views"
                }
            }
        },
        {
            $project: {
                totalViews: 1
            }
        }
    ])

    if (!totalViews || totalViews?.length === 0) {
        throw new apiError(404, "Views not found")
    }

    const totalLikes = await Like.aggregate([
        {
            $match: {
                video: {
                    $in: new mongoose.Types.ObjectId(userId)
                }
            }
        },
        {
            $count: "totalLikes"
        }
    ])

    if (!totalLikes || totalLikes?.length === 0) {
        throw new apiError(404, "Likes not found")
    }

    return res.status(200).json(
        new apiResponse(200, { totalVideos, totalLikes, totalSubscribers, totalViews }, "Channel stats found successfully")
    )

})
// TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

const getChannelVideos = asyncHandler(async (req, res) => {

    let uploadedVideos = []
    uploadedVideos = await Video.find({
        owner: req.user._id,
        isPublished: true
    }).lean()

    if (!uploadedVideos) {
        throw new apiError(404, "Videos not found")
    }

    return res.status(200).json(
        new apiResponse(200, uploadedVideos, "Uploaded videos fetched successfully")
    )
    // TODO: Get all the videos uploaded by the channel

})

export {
    getChannelStats,
    getChannelVideos
}