const asyncHandler = (requestFunction) => {
    return (req, res, next) => {
        Promise.resolve(requestFunction(req, res, next)).catch((err) => next(err))
    }
}


export {asyncHandler}


//Another approach
/*
const asyncHandler = (fnc) => async (req, res, next) => {
    try {
        await fnc(req, res, next)
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
        
    }
}
*/