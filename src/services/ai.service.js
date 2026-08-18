const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");


// =====================================================
// GEMINI AI
// =====================================================

if (!process.env.GOOGLE_GENAI_API_KEY) {
    console.warn("⚠️ GOOGLE_GENAI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});


// =====================================================
// GEMINI MODEL
// =====================================================

const GEMINI_MODEL = "gemini-3.6-flash";


// =====================================================
// INTERVIEW REPORT SCHEMA
// =====================================================

const interviewReportSchema = z.object({

    title: z.string(),

    matchScore: z.number()
        .min(0)
        .max(100),

    technicalQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    behavioralQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    skillGaps: z.array(
        z.object({
            skill: z.string(),
            severity: z.enum([
                "low",
                "medium",
                "high"
            ])
        })
    ),

    preparationPlan: z.array(
        z.object({
            day: z.number(),
            focus: z.string(),
            tasks: z.array(z.string())
        })
    )

});


// =====================================================
// RESUME PDF SCHEMA
// =====================================================

const resumePdfSchema = z.object({

    html: z.string()

});


// =====================================================
// GEMINI GENERATION
// =====================================================

async function generateGeminiContent(
    prompt,
    options = {}
) {

    console.log("==============================================");
    console.log("CALLING GEMINI");
    console.log("MODEL:", GEMINI_MODEL);
    console.log("==============================================");


    // -------------------------------------------------
    // API KEY CHECK
    // -------------------------------------------------

    if (!process.env.GOOGLE_GENAI_API_KEY) {

        const error = new Error(
            "GOOGLE_GENAI_API_KEY is missing."
        );

        error.status = 500;
        error.code = "GEMINI_API_KEY_MISSING";

        throw error;
    }


    try {

        const response =
            await ai.models.generateContent({

                model: GEMINI_MODEL,

                contents: prompt,

                config: {

                    responseMimeType:
                        "application/json",

                    ...(options.responseSchema
                        ? {
                            responseSchema:
                                options.responseSchema
                        }
                        : {})

                }

            });


        // -------------------------------------------------
        // EMPTY RESPONSE
        // -------------------------------------------------

        if (
            !response ||
            !response.text
        ) {

            const error = new Error(
                "Gemini returned an empty response."
            );

            error.status = 500;
            error.code =
                "GEMINI_EMPTY_RESPONSE";

            throw error;
        }


        console.log(
            "========== GEMINI SUCCESS =========="
        );


        return response;


    } catch (error) {

        console.error(
            "========== GEMINI ERROR =========="
        );

        console.error(
            "MODEL:",
            GEMINI_MODEL
        );

        console.error(
            "STATUS:",
            error?.status
        );

        console.error(
            "MESSAGE:",
            error?.message
        );


        // =================================================
        // 429 - QUOTA
        // =================================================

        if (
            Number(error?.status) === 429 ||
            error?.message?.includes(
                "RESOURCE_EXHAUSTED"
            ) ||
            error?.message?.toLowerCase()
                .includes("quota")
        ) {

            console.error(
                "❌ GEMINI FREE QUOTA EXCEEDED"
            );

            console.error(
                "❌ NO RETRY WILL BE ATTEMPTED"
            );


            const quotaError =
                new Error(
                    "Gemini free quota has been exceeded. Please try again after the quota resets."
                );


            quotaError.status = 429;

            quotaError.code =
                "GEMINI_QUOTA_EXCEEDED";


            throw quotaError;
        }


        // =================================================
        // 401 - API KEY
        // =================================================

        if (
            Number(error?.status) === 401
        ) {

            console.error(
                "❌ GEMINI AUTHENTICATION ERROR"
            );


            const authError =
                new Error(
                    "Gemini API key is invalid or authentication failed."
                );


            authError.status = 401;

            authError.code =
                "GEMINI_AUTH_ERROR";


            throw authError;
        }


        // =================================================
        // 404 - MODEL
        // =================================================

        if (
            Number(error?.status) === 404
        ) {

            console.error(
                "❌ GEMINI MODEL NOT AVAILABLE"
            );


            const modelError =
                new Error(
                    `Gemini model ${GEMINI_MODEL} is unavailable for this API key.`
                );


            modelError.status = 404;

            modelError.code =
                "GEMINI_MODEL_ERROR";


            throw modelError;
        }


        // =================================================
        // OTHER ERROR
        // =================================================

        throw error;

    }

}


// =====================================================
// GENERATE INTERVIEW REPORT
// =====================================================

async function generateInterviewReport({

    resume,

    selfDescription,

    jobDescription

}) {

    console.log(
        "=============================================="
    );

    console.log(
        "GENERATE INTERVIEW REPORT"
    );

    console.log(
        "=============================================="
    );


    // =================================================
    // PROMPT
    // =================================================

    const prompt = `

You are an expert technical interviewer and career coach.

Analyze the candidate using ONLY the information provided below.

========================
JOB DESCRIPTION
========================

${jobDescription || "Not provided"}


========================
RESUME
========================

${resume || "Not provided"}


========================
SELF DESCRIPTION
========================

${selfDescription || "Not provided"}


========================
TASK
========================

Generate a detailed interview preparation report.

Return ONLY valid JSON.

Use exactly this structure:

{
    "job_role": "string",

    "match_score": 0,

    "technical_interview_questions": [
        "string"
    ],

    "behavioral_interview_questions": [
        "string"
    ],

    "missing_skills": [
        "string"
    ],

    "skill_gap_severity": [
        "low"
    ],

    "preparation_plan": [
        "Day 1: string"
    ]
}


RULES:

- match_score must be between 0 and 100.
- Generate exactly 10 technical questions.
- Generate exactly 5 behavioral questions.
- Generate up to 5 missing skills.
- skill_gap_severity must match missing_skills.
- Generate exactly 7 preparation plan items.
- Do not invent candidate experience.
- Only use information from the resume and self description.
- Tailor questions to the job description.
- Make questions realistic for an actual interview.
- Make preparation steps practical.
- Return ONLY JSON.

`;


    try {

        // =================================================
        // CALL GEMINI
        // =================================================

        const response =
            await generateGeminiContent(
                prompt
            );


        // =================================================
        // PARSE JSON
        // =================================================

        let result;

        try {

            result =
                JSON.parse(
                    response.text
                );

        } catch (jsonError) {

            console.error(
                "❌ GEMINI RETURNED INVALID JSON"
            );

            console.error(
                response.text
            );

            const error =
                new Error(
                    "Gemini returned invalid JSON."
                );

            error.status = 500;

            error.code =
                "GEMINI_INVALID_JSON";

            throw error;
        }


        // =================================================
        // TECHNICAL QUESTIONS
        // =================================================

        const technicalQuestions =
            Array.isArray(
                result.technical_interview_questions
            )
                ? result
                    .technical_interview_questions
                    .map(question => ({

                        question:
                            String(question),

                        intention:
                            "To evaluate the candidate's technical knowledge and practical understanding.",

                        answer:
                            "Explain the concept clearly and give a practical example from your project experience."

                    }))
                : [];


        // =================================================
        // BEHAVIORAL QUESTIONS
        // =================================================

        const behavioralQuestions =
            Array.isArray(
                result.behavioral_interview_questions
            )
                ? result
                    .behavioral_interview_questions
                    .map(question => ({

                        question:
                            String(question),

                        intention:
                            "To evaluate communication, teamwork, problem-solving and professional behavior.",

                        answer:
                            "Answer using a real academic or project example. Explain the situation, action and result."

                    }))
                : [];


        // =================================================
        // SKILL GAPS
        // =================================================

        const skillGaps =
            Array.isArray(
                result.missing_skills
            )
                ? result.missing_skills
                    .map((skill, index) => {

                        const severity =
                            String(
                                result
                                    .skill_gap_severity?.[
                                        index
                                    ] ||
                                "medium"
                            ).toLowerCase();


                        return {

                            skill:
                                String(skill),

                            severity:
                                [
                                    "low",
                                    "medium",
                                    "high"
                                ].includes(
                                    severity
                                )
                                    ? severity
                                    : "medium"

                        };

                    })
                : [];


        // =================================================
        // PREPARATION PLAN
        // =================================================

        const preparationPlan =
            Array.isArray(
                result.preparation_plan
            )
                ? result.preparation_plan
                    .map((item, index) => {

                        const text =
                            String(item);


                        const match =
                            text.match(
                                /^Day\s*(\d+)\s*:\s*(.*)$/i
                            );


                        if (match) {

                            return {

                                day:
                                    Number(
                                        match[1]
                                    ),

                                focus:
                                    match[2]
                                        .split(".")[0]
                                        .trim(),

                                tasks: [
                                    match[2].trim()
                                ]

                            };

                        }


                        return {

                            day:
                                index + 1,

                            focus:
                                `Interview Preparation - Day ${index + 1}`,

                            tasks: [
                                text
                            ]

                        };

                    })
                : [];


        // =================================================
        // FINAL REPORT
        // =================================================

        let matchScore =
            Number(
                result.match_score
            );


        if (
            Number.isNaN(matchScore)
        ) {

            matchScore = 0;

        }


        if (matchScore < 0) {

            matchScore = 0;

        }


        if (matchScore > 100) {

            matchScore = 100;

        }


        const interviewReport = {

            title:
                typeof result.job_role === "string" &&
                result.job_role.trim()
                    ? result.job_role.trim()
                    : "Interview Preparation Plan",

            matchScore,

            technicalQuestions,

            behavioralQuestions,

            skillGaps,

            preparationPlan

        };


        // =================================================
        // ZOD VALIDATION
        // =================================================

        const validatedReport =
            interviewReportSchema.parse(
                interviewReport
            );


        console.log(
            "========== REPORT GENERATED =========="
        );


        return validatedReport;


    } catch (error) {

        console.error(
            "========== AI GENERATION ERROR =========="
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


        throw error;

    }

}


// =====================================================
// GENERATE PDF FROM HTML
// =====================================================

async function generatePdfFromHtml(
    htmlContent
) {

    let browser;


    try {

        browser =
            await puppeteer.launch({

                headless: true,

                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]

            });


        const page =
            await browser.newPage();


        await page.setContent(

            htmlContent,

            {
                waitUntil:
                    "networkidle0"
            }

        );


        const pdfBuffer =
            await page.pdf({

                format:
                    "A4",

                printBackground:
                    true,

                margin: {

                    top:
                        "15mm",

                    bottom:
                        "15mm",

                    left:
                        "15mm",

                    right:
                        "15mm"

                }

            });


        return pdfBuffer;


    } finally {

        if (browser) {

            await browser.close();

        }

    }

}


// =====================================================
// GENERATE RESUME PDF
// =====================================================

async function generateResumePdf({

    resume,

    selfDescription,

    jobDescription

}) {

    console.log(
        "=============================================="
    );

    console.log(
        "GENERATE RESUME PDF"
    );

    console.log(
        "=============================================="
    );


    const prompt = `

Create a professional ATS-friendly resume.

JOB DESCRIPTION:

${jobDescription || "Not provided"}


CURRENT RESUME:

${resume || "Not provided"}


SELF DESCRIPTION:

${selfDescription || "Not provided"}


REQUIREMENTS:

- Tailor the resume to the job description.
- Do not invent information.
- Use only information provided.
- Keep it professional.
- Keep it concise.
- Prefer 1-2 pages.
- Use simple HTML.
- Use proper headings.
- Highlight relevant technical skills.
- Include projects and experience only when provided.
- Return ONLY JSON.

JSON format:

{
    "html": "..."
}

`;


    try {

        const response =
            await generateGeminiContent(

                prompt,

                {

                    responseSchema:
                        zodToJsonSchema(
                            resumePdfSchema
                        )

                }

            );


        let jsonContent;


        try {

            jsonContent =
                JSON.parse(
                    response.text
                );

        } catch (jsonError) {

            const error =
                new Error(
                    "Gemini returned invalid resume JSON."
                );

            error.status = 500;

            error.code =
                "GEMINI_INVALID_RESUME_JSON";

            throw error;

        }


        const validatedContent =
            resumePdfSchema.parse(
                jsonContent
            );


        const pdfBuffer =
            await generatePdfFromHtml(
                validatedContent.html
            );


        return pdfBuffer;


    } catch (error) {

        console.error(
            "========== RESUME PDF ERROR =========="
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


        throw error;

    }

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    generateInterviewReport,

    generateResumePdf

};