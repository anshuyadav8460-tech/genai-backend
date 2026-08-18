const pdfParse = require("pdf-parse");

const {
    generateInterviewReport,
    generateResumePdf
} = require("../services/ai.service");

const interviewReportModel =
    require("../models/interviewReport.model");


// =====================================================
// GENERATE INTERVIEW REPORT
// =====================================================

async function generateInterViewReportController(
    req,
    res
) {

    try {

        console.log(
            "\n=============================================="
        );

        console.log(
            "🔥 INTERVIEW POST ROUTE HIT"
        );

        console.log(
            "=============================================="
        );


        // =================================================
        // AUTH
        // =================================================

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "User authentication required."

            });

        }


        console.log(
            "USER ID:",
            req.user.id
        );


        // =================================================
        // REQUEST BODY
        // =================================================

        const {

            selfDescription = "",

            jobDescription = ""

        } = req.body || {};


        console.log(
            "JOB DESCRIPTION LENGTH:",
            jobDescription.length
        );

        console.log(
            "SELF DESCRIPTION LENGTH:",
            selfDescription.length
        );


        // =================================================
        // VALIDATE JOB DESCRIPTION
        // =================================================

        if (
            typeof jobDescription !== "string" ||
            !jobDescription.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Job description is required."

            });

        }


        // =================================================
        // READ RESUME
        // =================================================

        let resumeText = "";


        if (req.file) {

            console.log(
                "RESUME:",
                req.file.originalname
            );


            try {

                const resumeBuffer =
                    Uint8Array.from(
                        req.file.buffer
                    );


                const resumeParser =
                    new pdfParse.PDFParse(
                        resumeBuffer
                    );


                const resumeContent =
                    await resumeParser.getText();


                resumeText =
                    resumeContent?.text || "";


                console.log(
                    "RESUME TEXT LENGTH:",
                    resumeText.length
                );


            } catch (pdfError) {

                console.error(
                    "❌ PDF PARSING ERROR:",
                    pdfError
                );


                return res.status(400).json({

                    success: false,

                    message:
                        "Failed to read the uploaded resume.",

                    error:
                        pdfError?.message

                });

            }

        }


        // =================================================
        // VALIDATE CANDIDATE
        // =================================================

        if (
            !resumeText.trim() &&
            !String(
                selfDescription
            ).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please upload your resume or provide self description."

            });

        }


        // =================================================
        // CALL GEMINI
        // =================================================

        console.log(
            "🤖 CALLING GEMINI..."
        );


        let aiReport;


        try {

            aiReport =
                await generateInterviewReport({

                    resume:
                        resumeText,

                    selfDescription:
                        String(
                            selfDescription
                        ),

                    jobDescription:
                        jobDescription.trim()

                });


        } catch (aiError) {

            console.error(
                "❌ GEMINI FAILED"
            );

            console.error(
                "STATUS:",
                aiError?.status
            );

            console.error(
                "CODE:",
                aiError?.code
            );

            console.error(
                "MESSAGE:",
                aiError?.message
            );


            // =================================================
            // GEMINI QUOTA
            // =================================================

            if (
                aiError?.code ===
                "GEMINI_QUOTA_EXCEEDED"
            ) {

                return res.status(429).json({

                    success: false,

                    code:
                        "GEMINI_QUOTA_EXCEEDED",

                    message:
                        "AI free quota is currently exhausted. Please try again after the quota resets."

                });

            }


            // =================================================
            // GEMINI API KEY
            // =================================================

            if (
                aiError?.code ===
                "GEMINI_API_KEY_MISSING"
            ) {

                return res.status(500).json({

                    success: false,

                    code:
                        "GEMINI_API_KEY_MISSING",

                    message:
                        "Gemini API key is not configured on the server."

                });

            }


            // =================================================
            // GEMINI AUTH
            // =================================================

            if (
                aiError?.code ===
                "GEMINI_AUTH_ERROR"
            ) {

                return res.status(401).json({

                    success: false,

                    code:
                        "GEMINI_AUTH_ERROR",

                    message:
                        "Gemini API authentication failed."

                });

            }


            // =================================================
            // MODEL ERROR
            // =================================================

            if (
                aiError?.code ===
                "GEMINI_MODEL_ERROR"
            ) {

                return res.status(503).json({

                    success: false,

                    code:
                        "GEMINI_MODEL_ERROR",

                    message:
                        "The configured Gemini model is currently unavailable."

                });

            }


            // =================================================
            // OTHER AI ERROR
            // =================================================

            return res.status(502).json({

                success: false,

                code:
                    aiError?.code ||
                    "GEMINI_ERROR",

                message:
                    aiError?.message ||
                    "AI service failed to generate the interview report."

            });

        }


        // =================================================
        // CHECK REPORT
        // =================================================

        if (!aiReport) {

            return res.status(502).json({

                success: false,

                message:
                    "AI returned an empty interview report."

            });

        }


        // =================================================
        // NORMALIZE DATA
        // =================================================

        const title =
            typeof aiReport.title === "string" &&
            aiReport.title.trim()
                ? aiReport.title.trim()
                : "Interview Preparation Plan";


        let matchScore =
            Number(
                aiReport.matchScore
            );


        if (
            Number.isNaN(matchScore)
        ) {

            matchScore = 0;

        }


        matchScore =
            Math.max(
                0,
                Math.min(
                    100,
                    matchScore
                )
            );


        const technicalQuestions =
            Array.isArray(
                aiReport.technicalQuestions
            )
                ? aiReport.technicalQuestions
                : [];


        const behavioralQuestions =
            Array.isArray(
                aiReport.behavioralQuestions
            )
                ? aiReport.behavioralQuestions
                : [];


        const skillGaps =
            Array.isArray(
                aiReport.skillGaps
            )
                ? aiReport.skillGaps
                : [];


        const preparationPlan =
            Array.isArray(
                aiReport.preparationPlan
            )
                ? aiReport.preparationPlan
                : [];


        // =================================================
        // SAVE TO MONGODB
        // =================================================

        console.log(
            "💾 SAVING REPORT TO DATABASE..."
        );


        const interviewReport =
            await interviewReportModel.create({

                user:
                    req.user.id,

                title,

                resume:
                    resumeText,

                selfDescription:
                    String(
                        selfDescription
                    ),

                jobDescription:
                    jobDescription.trim(),

                matchScore,

                technicalQuestions,

                behavioralQuestions,

                skillGaps,

                preparationPlan

            });


        console.log(
            "✅ REPORT SAVED:",
            interviewReport._id
        );


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            message:
                "Interview report generated successfully.",

            interviewReport

        });


    } catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "❌ INTERVIEW CONTROLLER ERROR"
        );

        console.error(
            "MESSAGE:",
            error?.message
        );

        console.error(
            "STATUS:",
            error?.status
        );

        console.error(
            "CODE:",
            error?.code
        );

        console.error(
            "STACK:",
            error?.stack
        );

        console.error(
            "=============================================="
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to generate interview report.",

            error:
                error?.message ||
                "Unknown server error."

        });

    }

}


// =====================================================
// GET REPORT BY ID
// =====================================================

async function getInterviewReportByIdController(
    req,
    res
) {

    try {

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "User authentication required."

            });

        }


        const {
            interviewId
        } = req.params;


        if (!interviewId) {

            return res.status(400).json({

                success: false,

                message:
                    "Interview report ID is required."

            });

        }


        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewId,

                user:
                    req.user.id

            });


        if (!interviewReport) {

            return res.status(404).json({

                success: false,

                message:
                    "Interview report not found."

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Interview report fetched successfully.",

            interviewReport

        });

    } catch (error) {

        console.error(
            "GET REPORT ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch interview report.",

            error:
                error?.message

        });

    }

}


// =====================================================
// GET ALL REPORTS
// =====================================================

async function getAllInterviewReportsController(
    req,
    res
) {

    try {

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "User authentication required."

            });

        }


        const interviewReports =
            await interviewReportModel

                .find({

                    user:
                        req.user.id

                })

                .sort({

                    createdAt:
                        -1

                })

                .select(
                    "-resume " +
                    "-selfDescription " +
                    "-jobDescription " +
                    "-__v " +
                    "-technicalQuestions " +
                    "-behavioralQuestions " +
                    "-skillGaps " +
                    "-preparationPlan"
                );


        return res.status(200).json({

            success: true,

            message:
                "Interview reports fetched successfully.",

            interviewReports

        });

    } catch (error) {

        console.error(
            "GET ALL REPORTS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch interview reports.",

            error:
                error?.message

        });

    }

}


// =====================================================
// GENERATE RESUME PDF
// =====================================================

async function generateResumePdfController(
    req,
    res
) {

    try {

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "User authentication required."

            });

        }


        const {
            interviewReportId
        } = req.params;


        if (!interviewReportId) {

            return res.status(400).json({

                success: false,

                message:
                    "Interview report ID is required."

            });

        }


        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewReportId,

                user:
                    req.user.id

            });


        if (!interviewReport) {

            return res.status(404).json({

                success: false,

                message:
                    "Interview report not found."

            });

        }


        console.log(
            "🤖 GENERATING RESUME PDF..."
        );


        const pdfBuffer =
            await generateResumePdf({

                resume:
                    interviewReport.resume,

                jobDescription:
                    interviewReport.jobDescription,

                selfDescription:
                    interviewReport.selfDescription

            });


        res.set({

            "Content-Type":
                "application/pdf",

            "Content-Disposition":
                `attachment; filename=resume_${interviewReportId}.pdf`

        });


        return res.send(
            pdfBuffer
        );


    } catch (error) {

        console.error(
            "RESUME PDF ERROR:",
            error
        );


        if (
            error?.code ===
            "GEMINI_QUOTA_EXCEEDED"
        ) {

            return res.status(429).json({

                success: false,

                code:
                    "GEMINI_QUOTA_EXCEEDED",

                message:
                    "AI free quota is currently exhausted. Please try again after the quota resets."

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Failed to generate resume PDF.",

            error:
                error?.message

        });

    }

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    generateInterViewReportController,

    getInterviewReportByIdController,

    getAllInterviewReportsController,

    generateResumePdfController

};