import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const isOwner = async (tweetId, req) => {
    const tweet = await Tweet.findById(tweetId).populate("owner")
    if (!tweet) {
        throw new apiError(400, "Cant find your tweet")
    }
    if (tweet.owner?._id !== req.user?._id) return false;

    return true
}

const createTweet = asyncHandler(async (req, res) => {

    const { content } = req.body
    // const {tweetId} = req.params
    if (!content) {
        throw new apiError(400, "Content not found")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    if (!tweet) {
        throw new apiError(404, "Problem while creating Tweet")
    }

    return res.status(200).json(
        new apiResponse(200, tweet, "Tweet created successfully")
    )

    //TODO: create tweet
})

const getUserTweets = asyncHandler(async (req, res) => {

    const {userId} = req.params
    // TODO: get user tweets
})

const updateTweet = asyncHandler(async (req, res) => {

    const { tweetId } = req.params
    const { updateContent } = req.body

    if (!tweetId) {
        throw new apiError(400, "Cant get tweetId")
    }

    const owner = isOwner(tweetId, req);
    if (!owner) {
        throw new apiError(400, "Cant update tweet, u r not owner")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId, {
        $set: {
            content: updateContent,
        }
    }, {
        new: true
    })

    return res.status(200).json(
        new apiResponse(200, updatedTweet, "Tweet updated successfully")
    )
    //TODO: update tweet
})

const deleteTweet = asyncHandler(async (req, res) => {

    const { tweetId } = req.params
    if (!tweetId) {
        throw new apiError(400, "Cant get tweetId")
    }

    const owner = isOwner(tweetId, req);
    if (!owner) {
        throw new apiError(400, "Cant delete tweet, u r not owner")
    }

    await Tweet.findByIdAndDelete(tweetId)

    return res.status(200).json(
        new apiResponse(200, {}, "Tweet deleted successfully")
    )

    //TODO: delete tweet
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}