import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "video id not found")
    }

    const alreadyLiked = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    let like;
    if (alreadyLiked) {
        like = await Like.findByIdAndDelete(alreadyLiked._id) //remove like
    }
    //add like
    like = await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    if (!like) {
        throw new apiError(400, "Problem while like the video")
    }

    return res.status(200).json(
        new apiResponse(200, like, "Liked fetched successfully")
    )
    //TODO: toggle like on video
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    if (!isValidObjectId(commentId)) {
        throw new apiError(400, "comment id not found")
    }

    const alreadyLiked = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    })

    let like;
    if (alreadyLiked) {
        like = await Like.findByIdAndDelete(alreadyLiked._id) //remove like
    }
    //add like
    like = await Like.create({
        comment: commentId,
        likedBy: req.user?._id
    })

    if (!like) {
        throw new apiError(400, "Problem while like the comment")
    }

    return res.status(200).json(
        new apiResponse(200, like, "Liked fetched successfully")
    )
    //TODO: toggle like on comment

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Tweet id not found")
    }

    const alreadyLiked = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    let like;
    if (alreadyLiked) {
        like = await Like.findByIdAndDelete(alreadyLiked._id) //remove like
    }
    //add like
    like = await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    if (!like) {
        throw new apiError(400, "Problem while like the tweet")
    }

    return res.status(200).json(
        new apiResponse(200, like, "Liked fetched successfully")
    )
    //TODO: toggle like on tweet
}
)

const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoData",
                pipeline: [
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            views: 1,
                            videoFile: "$videoFile?.public_id",
                            thumbnail: "$thumbnail?.public_id",
                            owner: 1
                        }
                    },
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
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $unwind: "$owner"
                    },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            views: 1,
                            videoFile: 1,
                            thumbnail: 1,
                            owner: {
                                username: 1,
                                avatar: 1
                            }
                        }
                    }
                ]
            }
        }
    ])

    if (!likedVideos || likedVideos.length === 0) {
        throw new apiError(404, "There are no liked videos")
    }

    return res.status(200).json(
        new apiResponse(200, likedVideos, "Liked videos fetched ")
    )
    //TODO: get all liked videos
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}