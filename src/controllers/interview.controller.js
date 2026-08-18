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

        console.log("");
        console.log("==============================================");
        console.log("GENERATE INTERVIEW REPORT REQUEST");
        console.log("==============================================");


        // =================================================
        // 1. AUTHENTICATION
        // =================================================

        console.log(
            "STEP 1: Checking user..."
        );


        if (
            !req.user ||
            !req.user.id
        ) {

            console.log(
                "❌ USER NOT AUTHENTICATED"
            );


            return res.status(401).json({

                success:
                    false,

                message:
                    "User authentication required."

            });

        }


        console.log(
            "USER ID:",
            req.user.id
        );


        // =================================================
        // 2. REQUEST BODY
        // =================================================

        console.log(
            "STEP 2: Reading request body..."
        );


        const {
            selfDescription = "",
            jobDescription = ""
        } = req.body || {};


        // =================================================
        // 3. VALIDATE JOB DESCRIPTION
        // =================================================

        console.log(
            "STEP 3: Validating job description..."
        );


        if (
            typeof jobDescription !== "string" ||
            !jobDescription.trim()
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Job description is required."

            });

        }


        // =================================================
        // 4. READ RESUME
        // =================================================

        console.log(
            "STEP 4: Checking resume..."
        );


        let resumeText = "";


        if (req.file) {

            console.log(
                "Resume received:",
                req.file.originalname
            );


            console.log(
                "Resume size:",
                req.file.size
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
                    resumeContent?.text ||
                    "";


                console.log(
                    "Resume text extracted successfully."
                );


                console.log(
                    "Resume text length:",
                    resumeText.length
                );


            } catch (pdfError) {

                console.error(
                    "❌ PDF PARSING ERROR:"
                );


                console.error(
                    pdfError
                );


                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Failed to read the uploaded resume.",

                    error:
                        pdfError?.message ||
                        "PDF parsing failed."

                });

            }

        } else {

            console.log(
                "No resume uploaded."
            );

        }


        // =================================================
        // 5. VALIDATE CANDIDATE DATA
        // =================================================

        console.log(
            "STEP 5: Validating candidate information..."
        );


        const cleanSelfDescription =
            typeof selfDescription === "string"
                ? selfDescription.trim()
                : "";


        const cleanResume =
            typeof resumeText === "string"
                ? resumeText.trim()
                : "";


        if (
            !cleanResume &&
            !cleanSelfDescription
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Please upload your resume or provide self description."

            });

        }


        // =================================================
        // 6. CALL AI
        // =================================================

        console.log(
            "STEP 6: Calling Gemini AI..."
        );


        const aiReport =
            await generateInterviewReport({

                resume:
                    cleanResume,

                selfDescription:
                    cleanSelfDescription,

                jobDescription:
                    jobDescription.trim()

            });


        console.log(
            "STEP 7: Gemini response received."
        );


        // =================================================
        // 7. SAFETY CHECK
        // =================================================

        if (!aiReport) {

            return res.status(500).json({

                success:
                    false,

                message:
                    "AI failed to generate interview report."

            });

        }


        // =================================================
        // 8. CLEAN REPORT DATA
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
        // 9. SAVE TO DATABASE
        // =================================================

        console.log(
            "STEP 8: Saving interview report to MongoDB..."
        );


        const interviewReport =
            await interviewReportModel.create({

                user:
                    req.user.id,

                title,

                resume:
                    cleanResume,

                selfDescription:
                    cleanSelfDescription,

                jobDescription:
                    jobDescription.trim(),

                matchScore,

                technicalQuestions,

                behavioralQuestions,

                skillGaps,

                preparationPlan

            });


        console.log(
            "STEP 9: REPORT SAVED SUCCESSFULLY"
        );


        console.log(
            "REPORT ID:",
            interviewReport._id
        );


        // =================================================
        // 10. RESPONSE
        // =================================================

        return res.status(201).json({

            success:
                true,

            message:
                "Interview report generated successfully.",

            interviewReport

        });


    } catch (error) {

        console.error("");
        console.error(
            "=============================================="
        );

        console.error(
            "GENERATE INTERVIEW REPORT ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            "NAME:",
            error?.name
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


        // =================================================
        // GEMINI QUOTA ERROR
        // =================================================

        if (
            Number(error?.status) === 429 ||
            error?.code ===
                "GEMINI_QUOTA_EXCEEDED"
        ) {

            console.error(
                "❌ GEMINI QUOTA EXCEEDED"
            );


            return res.status(429).json({

                success:
                    false,

                code:
                    "GEMINI_QUOTA_EXCEEDED",

                message:
                    "Gemini AI free quota has been exhausted. Please try again after the quota resets."

            });

        }


        // =================================================
        // GEMINI AUTH ERROR
        // =================================================

        if (
            Number(error?.status) === 401 ||
            error?.code ===
                "GEMINI_AUTH_ERROR"
        ) {

            return res.status(401).json({

                success:
                    false,

                code:
                    "GEMINI_AUTH_ERROR",

                message:
                    "Gemini API authentication failed. Please check GOOGLE_GENAI_API_KEY."

            });

        }


        // =================================================
        // GEMINI MODEL ERROR
        // =================================================

        if (
            Number(error?.status) === 404 ||
            error?.code ===
                "GEMINI_MODEL_ERROR"
        ) {

            return res.status(500).json({

                success:
                    false,

                code:
                    "GEMINI_MODEL_ERROR",

                message:
                    "The configured Gemini model is not available for this API key."

            });

        }


        // =================================================
        // NORMAL ERROR
        // =================================================

        return res.status(500).json({

            success:
                false,

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

        console.log(
            "GET INTERVIEW REPORT BY ID"
        );


        // =================================================
        // AUTH
        // =================================================

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success:
                    false,

                message:
                    "User authentication required."

            });

        }


        // =================================================
        // ID
        // =================================================

        const {
            interviewId
        } = req.params;


        if (!interviewId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Interview report ID is required."

            });

        }


        // =================================================
        // FIND REPORT
        // =================================================

        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewId,

                user:
                    req.user.id

            });


        if (!interviewReport) {

            return res.status(404).json({

                success:
                    false,

                message:
                    "Interview report not found."

            });

        }


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success:
                true,

            message:
                "Interview report fetched successfully.",

            interviewReport

        });


    } catch (error) {

        console.error(
            "GET INTERVIEW REPORT ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                "Failed to fetch interview report.",

            error:
                error?.message ||
                "Unknown server error."

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

        console.log(
            "GET ALL INTERVIEW REPORTS"
        );


        // =================================================
        // AUTH
        // =================================================

        if (
            !req.user ||
            !req.user.id
        ) {

            return res.status(401).json({

                success:
                    false,

                message:
                    "User authentication required."

            });

        }


        // =================================================
        // FIND REPORTS
        // =================================================

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


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success:
                true,

            message:
                "Interview reports fetched successfully.",

            interviewReports

        });


    } catch (error) {

        console.error(
            "GET ALL INTERVIEW REPORTS ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                "Failed to fetch interview reports.",

            error:
                error?.message ||
                "Unknown server error."

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

        console.log(
            "=============================================="
        );

        console.log(
            "GENERATE RESUME PDF"
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

                success:
                    false,

                message:
                    "User authentication required."

            });

        }


        // =================================================
        // GET REPORT ID
        // =================================================

        const {
            interviewReportId
        } = req.params;


        if (!interviewReportId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Interview report ID is required."

            });

        }


        // =================================================
        // FIND REPORT
        // =================================================

        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewReportId,

                user:
                    req.user.id

            });


        if (!interviewReport) {

            return res.status(404).json({

                success:
                    false,

                message:
                    "Interview report not found."

            });

        }


        // =================================================
        // DATA
        // =================================================

        const {

            resume,

            jobDescription,

            selfDescription

        } = interviewReport;


        // =================================================
        // AI PDF
        // =================================================

        console.log(
            "Calling AI for resume PDF..."
        );


        const pdfBuffer =
            await generateResumePdf({

                resume,

                jobDescription,

                selfDescription

            });


        // =================================================
        // SEND PDF
        // =================================================

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
            "=============================================="
        );

        console.error(
            "RESUME PDF ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            "NAME:",
            error?.name
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


        // =================================================
        // QUOTA
        // =================================================

        if (
            Number(error?.status) === 429 ||
            error?.code ===
                "GEMINI_QUOTA_EXCEEDED"
        ) {

            return res.status(429).json({

                success:
                    false,

                code:
                    "GEMINI_QUOTA_EXCEEDED",

                message:
                    "Gemini AI free quota has been exhausted. Please try again after the quota resets."

            });

        }


        // =================================================
        // AUTH
        // =================================================

        if (
            Number(error?.status) === 401 ||
            error?.code ===
                "GEMINI_AUTH_ERROR"
        ) {

            return res.status(401).json({

                success:
                    false,

                code:
                    "GEMINI_AUTH_ERROR",

                message:
                    "Gemini API authentication failed."

            });

        }


        // =================================================
        // NORMAL ERROR
        // =================================================

        return res.status(500).json({

            success:
                false,

            message:
                "Failed to generate resume PDF.",

            error:
                error?.message ||
                "Unknown server error."

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