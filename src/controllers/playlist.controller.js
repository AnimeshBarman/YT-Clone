import mongoose, { isValidObjectId } from "mongoose";
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { Playlist } from "../models/playlist.model.js";
import { asyncHandler } from "../utils/asyncHandler.js"



const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body
    if (!name) {
        throw new apiError(400, "Playlist name is required")
    }

    const playlist = await Playlist.create({
        name,
        description,
        videos: [],
        owner: req.user?._id
    })

    if (!playlist) {
        throw new apiError(404, "Playlist not found")
    }

    return res.status(200).json(200, playlist, "Playlist created successfully")

    //TODO: create playlist
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params
    if (!isValidObjectId(userId)) {
        throw new apiError(404, "user not found")
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $project: {
                title: 1,
                videos: 1,
                owner: { $first: "$owner" }
            }
        }
    ])

    if (!playlists || playlists?.length === 0) {
        throw new apiError(404, "Playlist not found")
    }

    return res.status(200).json(
        new apiResponse(200, playlists, "Playlists found successfully")
    )
    //TODO: get user playlists
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    if (!isValidObjectId(playlistId)) {
        throw new apiError(404, "playlist not found")
    }

    const playlist = await Playlist.aggregate([
        {
            $match: new mongoose.Types.ObjectId(playlistId)
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            title: 1,
                            description: 1,
                            thumbnail: thumbnail?.public_id,
                            videoFile: videoFile?.public_id
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$videos"
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
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                videos: 1,
                owner: { $first: "$owner" }
            }
        }
    ])

    if (!playlist || playlist?.length === 0) {
        throw new apiError(404, "playlist not found")
    }

    return res.status(200).json(
        new apiResponse(200, playlist[0], "Playlist found successfully")
    )

    //TODO: get playlist by id
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    if (!(isValidObjectId(playlistId) && isValidObjectId(videoId))) {
        throw new apiError(404, "Playlist and video id is missing")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new apiError(404, "Playlist not found")
    }

    const videoIndex = playlist.videos.findIndex((video) => video?._id.toString() === videoId)

    if (videoIndex) {
        throw new apiError(400, "video already exist")
    }


    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push: {
                videos: { _id: videoId }
            }
        },
        { new: true }
    )

    if (!updatedPlaylist) {
        throw new apiError(400, "cant add videos")
    }

    return res.status(200).json(
        new apiResponse(200, updatedPlaylist, "video added to the playlist")
    )

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!(isValidObjectId(playlistId) && isValidObjectId(videoId))) {
        throw new apiError(404, "cant find video and playlist")
    }

    const playlist = Playlist.findById(playlistId)
    if (!playlist) {
        throw new apiError(404, "playlist not found")
    }

    const videoIndex = playlist.videos.findIndex((video) => video?._id.toString() === videoId)

    if (videoIndex === -1) {
        throw new apiError(404, "video not found")
    }

    const removedVideo = await Playlist.findByIdAndUpdate(videoId,
        {
            $pull: {
                videos: { _id: videoId }
            }
        }, { new: true }
    )

    if (!removedVideo) {
        throw new apiError(400, "Problem while remove the video from playlist")
    }

    return res.status(200).json(
        new apiResponse(200, removedVideo, "Video removed from playlist")
    )
    // TODO: remove video from playlist

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    if (!isValidObjectId(playlistId)) {
        throw new apiError(404, "Playlist not found")
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)
    if (!deletedPlaylist) {
        throw new apiError(400, "Problem while deleting the playlist")
    }

    return res.status(200).json(
        new apiResponse(200, {}, "Playlist deleted successfully")
    )

    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body

    if (!isValidObjectId(playlistId)) {
        throw new apiError(400, "invalid playlist id")
    }

    if (!name) {
        throw new apiError(400, "Name is required for update the playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true
        }
    )

    if (!updatedPlaylist) {
        throw new apiError(400, "Problem while updating the playlist")
    }

    return res.status(200).json(
        new apiResponse(200, {}, "Playlist updated successfully")
    )

    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}