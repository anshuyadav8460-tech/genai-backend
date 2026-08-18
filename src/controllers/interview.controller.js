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

async function generateInterViewReportController(req, res) {

    try {

        console.log("\n");
        console.log("==============================================");
        console.log("GENERATE INTERVIEW REPORT REQUEST");
        console.log("==============================================");


        // =================================================
        // 1. CHECK USER AUTHENTICATION
        // =================================================

        console.log("STEP 1: Checking user...");

        if (!req.user || !req.user.id) {

            console.log("USER NOT AUTHENTICATED");

            return res.status(401).json({
                message: "User authentication required."
            });

        }

        console.log("USER ID:", req.user.id);


        // =================================================
        // 2. GET REQUEST BODY
        // =================================================

        console.log("STEP 2: Reading request body...");

        const {
            selfDescription = "",
            jobDescription = ""
        } = req.body || {};


        console.log("JOB DESCRIPTION:");
        console.log(jobDescription);

        console.log("SELF DESCRIPTION:");
        console.log(selfDescription);


        // =================================================
        // 3. VALIDATE JOB DESCRIPTION
        // =================================================

        console.log("STEP 3: Validating job description...");

        if (
            typeof jobDescription !== "string" ||
            !jobDescription.trim()
        ) {

            console.log("JOB DESCRIPTION MISSING");

            return res.status(400).json({
                message: "Job description is required."
            });

        }


        // =================================================
        // 4. READ RESUME
        // =================================================

        console.log("STEP 4: Checking resume...");

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
                    Uint8Array.from(req.file.buffer);


                const resumeParser =
                    new pdfParse.PDFParse(
                        resumeBuffer
                    );


                const resumeContent =
                    await resumeParser.getText();


                resumeText =
                    resumeContent?.text || "";


                console.log(
                    "Resume text extracted successfully."
                );

                console.log(
                    "Resume text length:",
                    resumeText.length
                );


            } catch (pdfError) {

                console.error(
                    "PDF PARSING ERROR:"
                );

                console.error(
                    pdfError
                );

                return res.status(400).json({

                    message:
                        "Failed to read the uploaded resume.",

                    error:
                        pdfError.message

                });

            }

        } else {

            console.log(
                "No resume uploaded."
            );

        }


        // =================================================
        // 5. VALIDATE RESUME / SELF DESCRIPTION
        // =================================================

        console.log(
            "STEP 5: Validating candidate information..."
        );


        if (
            !resumeText.trim() &&
            (
                typeof selfDescription !== "string" ||
                !selfDescription.trim()
            )
        ) {

            console.log(
                "RESUME AND SELF DESCRIPTION BOTH EMPTY"
            );

            return res.status(400).json({

                message:
                    "Please upload your resume or provide self description."

            });

        }


        // =================================================
        // 6. CALL GEMINI
        // =================================================

        console.log(
            "STEP 6: Calling Gemini AI..."
        );


        const aiReport =
            await generateInterviewReport({

                resume: resumeText,

                selfDescription:
                    typeof selfDescription === "string"
                        ? selfDescription
                        : "",

                jobDescription

            });


        console.log(
            "STEP 7: Gemini response received."
        );


        console.log(
            "AI REPORT:"
        );

        console.log(
            JSON.stringify(
                aiReport,
                null,
                2
            )
        );


        // =================================================
        // 7. CHECK AI RESPONSE
        // =================================================

        if (!aiReport) {

            console.error(
                "AI REPORT IS EMPTY"
            );

            return res.status(500).json({

                message:
                    "AI failed to generate interview report."

            });

        }


        // =================================================
        // 8. VALIDATE TITLE
        // =================================================

        const title =
            typeof aiReport.title === "string" &&
            aiReport.title.trim()
                ? aiReport.title.trim()
                : "Interview Preparation Plan";


        // =================================================
        // 9. VALIDATE MATCH SCORE
        // =================================================

        let matchScore =
            Number(aiReport.matchScore);


        if (
            Number.isNaN(matchScore) ||
            matchScore < 0 ||
            matchScore > 100
        ) {

            matchScore = 0;

        }


        // =================================================
        // 10. VALIDATE ARRAYS
        // =================================================

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
        // 11. SAVE REPORT TO DATABASE
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
                    resumeText,

                selfDescription:
                    typeof selfDescription === "string"
                        ? selfDescription
                        : "",

                jobDescription,

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
        // 12. SEND RESPONSE
        // =================================================

        return res.status(201).json({

            message:
                "Interview report generated successfully.",

            interviewReport

        });


    } catch (error) {


        // =================================================
        // GLOBAL ERROR
        // =================================================

        console.error("\n");
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
            "ERROR NAME:",
            error?.name
        );


        console.error(
            "ERROR MESSAGE:",
            error?.message
        );


        console.error(
            "ERROR STATUS:",
            error?.status
        );


        console.error(
            "ERROR CODE:",
            error?.code
        );


        console.error(
            "ERROR STACK:"
        );

        console.error(
            error?.stack
        );


        console.error(
            "FULL ERROR:"
        );

        console.error(
            error
        );


        return res.status(500).json({

            message:
                "Failed to generate interview report.",

            error:
                error?.message ||
                "Unknown server error."

        });

    }

}


// =====================================================
// GET INTERVIEW REPORT BY ID
// =====================================================

async function getInterviewReportByIdController(
    req,
    res
) {

    try {

        console.log(
            "GET INTERVIEW REPORT BY ID"
        );


        // -----------------------------------------------
        // AUTH CHECK
        // -----------------------------------------------

        if (!req.user || !req.user.id) {

            return res.status(401).json({

                message:
                    "User authentication required."

            });

        }


        // -----------------------------------------------
        // GET ID
        // -----------------------------------------------

        const {
            interviewId
        } = req.params;


        if (!interviewId) {

            return res.status(400).json({

                message:
                    "Interview report ID is required."

            });

        }


        // -----------------------------------------------
        // FIND REPORT
        // -----------------------------------------------

        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewId,

                user:
                    req.user.id

            });


        // -----------------------------------------------
        // NOT FOUND
        // -----------------------------------------------

        if (!interviewReport) {

            return res.status(404).json({

                message:
                    "Interview report not found."

            });

        }


        // -----------------------------------------------
        // RESPONSE
        // -----------------------------------------------

        return res.status(200).json({

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

            message:
                "Failed to fetch interview report.",

            error:
                error.message

        });

    }

}


// =====================================================
// GET ALL INTERVIEW REPORTS
// =====================================================

async function getAllInterviewReportsController(
    req,
    res
) {

    try {

        console.log(
            "GET ALL INTERVIEW REPORTS"
        );


        // -----------------------------------------------
        // AUTH CHECK
        // -----------------------------------------------

        if (!req.user || !req.user.id) {

            return res.status(401).json({

                message:
                    "User authentication required."

            });

        }


        // -----------------------------------------------
        // GET REPORTS
        // -----------------------------------------------

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


        // -----------------------------------------------
        // RESPONSE
        // -----------------------------------------------

        return res.status(200).json({

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

            message:
                "Failed to fetch interview reports.",

            error:
                error.message

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
            "GENERATE RESUME PDF"
        );


        // -----------------------------------------------
        // AUTH CHECK
        // -----------------------------------------------

        if (!req.user || !req.user.id) {

            return res.status(401).json({

                message:
                    "User authentication required."

            });

        }


        // -----------------------------------------------
        // GET INTERVIEW ID
        // -----------------------------------------------

        const {
            interviewReportId
        } = req.params;


        if (!interviewReportId) {

            return res.status(400).json({

                message:
                    "Interview report ID is required."

            });

        }


        // -----------------------------------------------
        // FIND REPORT
        // -----------------------------------------------

        const interviewReport =
            await interviewReportModel.findOne({

                _id:
                    interviewReportId,

                user:
                    req.user.id

            });


        if (!interviewReport) {

            return res.status(404).json({

                message:
                    "Interview report not found."

            });

        }


        // -----------------------------------------------
        // GET DATA
        // -----------------------------------------------

        const {
            resume,
            jobDescription,
            selfDescription
        } = interviewReport;


        // -----------------------------------------------
        // GENERATE PDF
        // -----------------------------------------------

        console.log(
            "Calling AI for resume PDF..."
        );


        const pdfBuffer =
            await generateResumePdf({

                resume,

                jobDescription,

                selfDescription

            });


        // -----------------------------------------------
        // SEND PDF
        // -----------------------------------------------

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
            "STACK:",
            error?.stack
        );


        return res.status(500).json({

            message:
                "Failed to generate resume PDF.",

            error:
                error?.message ||
                "Unknown error."

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