const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const interviewController = require("../controllers/interview.controller");
const upload = require("../middlewares/file.middleware");

const interviewRouter = express.Router();

interviewRouter.post(
    "/",

    (req, res, next) => {
        console.log("🔥 INTERVIEW POST ROUTE HIT");
        next();
    },

    authMiddleware.authUser,

    (req, res, next) => {
        console.log("🔥 AUTH MIDDLEWARE PASSED");
        next();
    },

    upload.single("resume"),

    (req, res, next) => {
        console.log("🔥 FILE MIDDLEWARE PASSED");
        console.log("FILE:", req.file?.originalname);
        console.log("BODY:", req.body);
        next();
    },

    interviewController.generateInterViewReportController
);


interviewRouter.get(
    "/report/:interviewId",
    authMiddleware.authUser,
    interviewController.getInterviewReportByIdController
);


interviewRouter.get(
    "/",
    authMiddleware.authUser,
    interviewController.getAllInterviewReportsController
);


interviewRouter.post(
    "/resume/pdf/:interviewReportId",
    authMiddleware.authUser,
    interviewController.generateResumePdfController
);


module.exports = interviewRouter;