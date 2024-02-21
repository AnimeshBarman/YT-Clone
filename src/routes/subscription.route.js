import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js"
import {verifyJWT} from "../middlewares/verifyUser.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/channel/:channelId")
    .get(getSubscribedChannels)
    .post(toggleSubscription);

router.route("/user/:subscriberId").get(getUserChannelSubscribers);

export default router