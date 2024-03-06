import mongoose, {isValidObjectId} from "mongoose"
import { Comment } from "../models/comment.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const isOwner = async (commentId, req) => {
    const comment = await Comment.findById(commentId).populate("owner")
    if (!comment) {
        throw new apiError(404, "comment not available")
    }

    if (comment.owner._id !== req.user?._id) return false;

    return true;
}

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "invalid video id")
    }

    try {
        const pageNum = Number(page)
        if (isNaN(pageNum) || pageNum < 1) {
            throw new apiError(400, "Invalid page number")
        }

        const commentlimit = Number(limit)
        if (isNaN(commentlimit) || commentlimit < 1 || commentlimit > 50) {
            throw new apiError(400, "Invalid limit, max limit is 50")
        }

    } catch (error) {
        console.log("Error while validating comment limit and page number: ", error);
        throw new apiError(500, "Validation error")
    }

    const options = {
        page: pageNum,
        limit: commentlimit,
    }

    const aggregate = [
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $project: {
                content: 1,
                owner: 1
            }
        }
    ];

    const comments = await Comment.aggregatePaginate(aggregate, options)

    if (!comments || comments.length === 0) {
        throw new apiError(404, "Comments not found")
    }

    return res.status(200).json(
        new apiResponse(200, comments, "Comments fetched successfully")
    )

})

const addComment = asyncHandler(async (req, res) => {

    const { videoId } = req.params
    const { content } = req.body

    if (!isValidObjectId(videoId)) {
        throw new apiError(404, "Video not found")
    }

    if (!content) {
        throw new apiError(400, "fill the content")
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id
    })

    if (!comment) {
        throw new apiError(400, "Comment not created")
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, comment, "comment added successfully")
        )
    // TODO: add a comment to a video
})

const updateComment = asyncHandler(async (req, res) => {

    const { commentId } = req.params
    const { updateComment } = req.body

    if (!updateComment) {
        throw new apiError(400, "update comment field missing")
    }
    if (!isValidObjectId(commentId)) return;

    const comment = await Comment.findById(commentId)
    if (!comment) {
        throw new apiError(404, "comment not available")
    }

    const owner = isOwner(commentId, req)
    if (!owner) {
        throw new apiError(400, "Cant able to update comment bcz u r not the owner")
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId, {
        $set: {
            content: updateComment
        }
    },
        {
            new: true
        }
    )

    if (!updateComment) {
        throw new apiError(500, "Problem while updating comment")
    }

    return res.status(200).json(
        new apiResponse(200, updatedComment, "Comment updated successfully")
    )

    // TODO: update a comment
})

const deleteComment = asyncHandler(async (req, res) => {

    const { commentId } = req.params

    if (!commentId) {
        throw new apiError(400, "commentId missing while deleting")
    }

    const owner = isOwner(commentId, req)
    if (!owner) {
        throw new apiError(400, "U r not the owner for delete the comment")
    }

    await Comment.findByIdAndDelete(commentId)

    return res.status(200).json(
        new apiResponse(200, "Comment deleted successfully")
    )
    // TODO: delete a comment
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}