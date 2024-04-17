import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {

    return res.status(200).json(
        new apiResponse(200, {}, "Health is fine")
    )
    //TODO: build a healthcheck response that simply returns the OK status as json with a message
})

export {
    healthcheck
    }
    