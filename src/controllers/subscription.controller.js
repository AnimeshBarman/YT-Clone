import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if (!isValidObjectId(channelId)) {
        throw new apiError(404, "Channel not found")
    }

    const alreadySubscribed = await Subscription.findOne({
        channel: channelId,
        subscriber: req.user._id
    })

    let subscribe
    if (alreadySubscribed) {
        subscribe = await Subscription.findByIdAndDelete(alreadySubscribed?._id)
    }

    subscribe = await Subscription.create({
        channel: channelId,
        subscribers: req.user._id
    })

    return res.status(200).json(
        new apiResponse(200, subscribe, "toggle subscribe done")
    )
    // TODO: toggle subscription
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if (!isValidObjectId(channelId)) {
        throw new apiError(404, "Channel not found while listing the subscribers")
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscribers",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullname:1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                $first: {
                    subscribers: "$subscribers"
                }
            }
        }
    ])

    if(!subscribers || subscribers.length === 0) {
        throw new apiError(404, "Cant find subscribers")
    }

    return res.status(200).json(
        new apiResponse(200, subscribers, "All subscribers are found successfully")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if (!isValidObjectId(subscriberId)) {
        throw new apiError(404, "Channels not found that you subscribed")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channels",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                $first: {
                    allChannels: "$channels"
                }
            }
        }
    ])

    if(!subscribedChannels || subscribedChannels.length === 0) {
        throw new apiError(404, "Cant find Channels")
    }

    return res.status(200).json(
        new apiResponse(200, subscribedChannels, "All Channels are found successfully that you have subscribed")
    )

})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}