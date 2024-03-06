import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"


const isOwner = async (req, videoId) => {
    const video = await Video.findById(videoId).populate("owner")
    if (!video) {
        throw new apiError(404, "Video not found")
    }
    if (video.owner !== req.user?._id) {
        return false
    }

    return true;
}


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    try {
        const pageNum = Number(page);
        if (isNaN(pageNum) || pageNum < 1) {
            throw new apiError(400, "Invalid page number")
        }

        const videosPerPage = Number(limit);
        if (isNaN(videosPerPage) || videosPerPage < 1 || videosPerPage > 20) {
            throw new apiError(400, "Invalid video limit, maximum limit is 20")
        }

    } catch (error) {
        console.log("Error validating query: ", error);
        throw new apiError(400, "Invalid query")
    }

    try {
        let pipeline = [];

        if (query) {
            pipeline.push({
                $match: {
                    title: {
                        $regex: query,
                        $options: "i"
                    }
                }
            })
        }

        //find videos based on userId
        if (isValidObjectId(userId)) {
            const user = await User.findById(userId)
            if (!user) {
                throw new apiError(404, "User not found")
            }

            pipeline.push({
                $match: {
                    owner: userId
                }
            })
        }

        if (sortBy) {
            pipeline.push({
                $sort: { [sortBy]: sortType }
            })
        } else {
            pipeline.push({
                $sort: { createdAt: -1 }
            })
        }

        const options = {
            page: pageNum,
            limit: videosPerPage,
        }

        const videos = await Video.aggregatePaginate(pipeline, options)

        return res.status(200).json(
            new apiResponse(200, videos, "Videos fetched successfully")
        )
    } catch (error) {
        console.log("Error while fetching videos: ", error);
        throw new apiError(500, "Problem while fetching videos")
    }
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body

    if ([title, description].some(field => field?.trim().length === "")) {
        throw new apiError(400, "Title or Descrition is needed")
    }

    let videoFileLocalPath;
    if (req.files && Array.isArray(req.files.videoFile && req.files.videoFile.length > 0)) {
        videoFileLocalPath = req.files.videoFile[0].path
    }

    let thumbnailLocalPath;
    if (req.files && Array.isArray(req.files.thumbnail && req.files.thumbnail.length > 0)) {
        thumbnailLocalPath = req.files.thumbnail[0].path
    }

    if (!(videoFileLocalPath && thumbnailLocalPath)) {
        throw new apiError(400, "Video and Thumbnail local path is missing")
    }

    const videoOnCloud = await uploadOnCloudinary(videoFileLocalPath)
    if (!videoOnCloud) {
        throw new apiError(400, "Video is not uploaded on cloudinary")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnail) {
        throw new apiError(400, "Thumbnail is not uploaded on cloudinary")
    }

    const videoFile = await Video.create({
        title,
        description,
        videoFile: {
            url: videoOnCloud.url,
            public_id: videoOnCloud.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        duration: videoOnCloud.duration,
        isPublished: true,
        owner: req.user?._id
    })

    const uploadedVideo = await Video.findById(videoFile._id)

    if (!uploadedVideo) {
        throw new apiError(400, "Video is not uploaded")
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, uploadedVideo, "Video upload successfull")
        )
    // TODO: get video, upload to cloudinary, create video
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Video is not available")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
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
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
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
                            username: 1,
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $addFields: {
                comments: "$comments",
                likes: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                views: 1,
                likes: 1,
                comments: 1,
                duration: 1,
                title: 1,
                description: 1,
                owner: 1,
                isLiked: 1,
                likes: 1
            }
        }
    ])

    if (!video && video.length === 0) {
        throw new apiError(404, "Video not found by ID")
    }

    const videoRef = video[0];

    await Video.findByIdAndUpdate(//Incrementing views on video
        videoRef._id,
        {
            $inc: { views: 1 }
        },
        {
            new: true
        }
    )

    const user = await User.findById(req.user._id)

    await user.watchHistory.push({ videoId })//add video to watch history
    await user.save({
        validateBeforeSave: false
    })

    return res.status(200).json(
        new apiResponse(200, video[0], "Video fetched successfully")
    )
    //TODO: get video details by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    const thumbnailLocalPath = req.file?.path;

    if ([videoId, title, description].some(field => field.trim() === "")) {
        throw new apiError(400, "Required all fields for update Video")
    }

    if (!thumbnail) {
        throw new apiError(400, "Thumbnail is missing")
    }

    // const video = await Video.findById(videoId).populate('owner')
    // if (video.owner !== req.user._id) {
    //     throw new apiError(400, "Can not update, u r not the Owner")
    // }

    const ownerCheck = isOwner(videoId, req.user);

    if (!ownerCheck) {
        throw new apiError(400, "You are not the Owner cant proceed")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    const updatedVideo = await Video.findByIdAndUpdate(videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    url: thumbnail?.url,
                    public_id: thumbnail.public_id
                }
            }
        },
        {
            new: true
        })

    if (!updatedVideo) {
        throw new apiError(400, "Video is not updated")
    }

    await deleteFromCloudinary(thumbnail.public_id, "image")

    return res
        .status(200)
        .json(
            new apiResponse(200, updatedVideo, "Video updated successfully")
        )
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Video id is missing")
    }


    const ownerCheck = isOwner(videoId, req.user);

    if (!ownerCheck) {
        throw new apiError(400, "You are not the Owner cant proceed")
    }

    const deletedVideo = await Video.findByIdAndDelete(video._id).select("-title -description")

    await deleteFromCloudinary(video.thumbnail.public_id, "image")
    await deleteFromCloudinary(video.videoFile.public_id, "video")

    return res
        .status(200)
        .json(
            new apiResponse(200, deletedVideo, "Video deleted successfully")
        )
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "invalid video id")
    }

    const ownerCheck = isOwner(videoId, req.user);

    if (!ownerCheck) {
        throw new apiError(400, "You are not the Owner cant proceed")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:
                { isPublished: { $not: "$isPublished" } }
        },
        { new: true }
    )

    if (!updatedVideo) {
        throw new apiError(500, "Internal error occurred in togglePublishStatus")
    }

    return res.status(200).json(
        new apiResponse(200, updatedVideo, "Toggle successful for video publish")
    )

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}