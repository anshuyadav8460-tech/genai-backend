const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

// =====================================================
// GEMINI CONFIG
// =====================================================

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;

const GEMINI_MODEL =
    process.env.GEMINI_MODEL || "gemini-3.6-flash";

if (!GEMINI_API_KEY) {
    console.error(
        "❌ GOOGLE_GENAI_API_KEY is missing."
    );
}

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});


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
// GEMINI ERROR HANDLER
// =====================================================

function createGeminiError(error) {

    const status =
        Number(error?.status);

    const message =
        String(error?.message || "");

    // ---------------------------------------------
    // 429 - QUOTA EXCEEDED
    // ---------------------------------------------

    if (
        status === 429 ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.toLowerCase().includes("quota exceeded") ||
        message.toLowerCase().includes("exceeded your current quota")
    ) {

        const quotaError = new Error(
            "Gemini free quota has been exceeded. Please try again after the quota resets."
        );

        quotaError.status = 429;

        quotaError.code =
            "GEMINI_QUOTA_EXCEEDED";

        return quotaError;
    }


    // ---------------------------------------------
    // 401 - API KEY ERROR
    // ---------------------------------------------

    if (status === 401) {

        const authError = new Error(
            "Gemini API key is invalid or authentication failed."
        );

        authError.status = 401;

        authError.code =
            "GEMINI_AUTH_ERROR";

        return authError;
    }


    // ---------------------------------------------
    // 403 - PERMISSION
    // ---------------------------------------------

    if (status === 403) {

        const permissionError = new Error(
            "Gemini API access is not permitted for this API key."
        );

        permissionError.status = 403;

        permissionError.code =
            "GEMINI_PERMISSION_ERROR";

        return permissionError;
    }


    // ---------------------------------------------
    // 404 - MODEL NOT FOUND
    // ---------------------------------------------

    if (status === 404) {

        const modelError = new Error(
            `Gemini model "${GEMINI_MODEL}" is unavailable.`
        );

        modelError.status = 404;

        modelError.code =
            "GEMINI_MODEL_ERROR";

        return modelError;
    }


    // ---------------------------------------------
    // OTHER ERROR
    // ---------------------------------------------

    return error;
}


// =====================================================
// GEMINI GENERATION
// =====================================================

async function generateGeminiContent(prompt, options = {}) {

    if (!GEMINI_API_KEY) {

        const error =
            new Error(
                "Gemini API key is not configured."
            );

        error.status = 500;
        error.code =
            "GEMINI_API_KEY_MISSING";

        throw error;
    }

    const MAX_RETRIES = 3;

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {

        console.log(
            "=============================================="
        );

        console.log(
            "========== CALLING GEMINI =========="
        );

        console.log(
            "MODEL:",
            GEMINI_MODEL
        );

        console.log(
            "ATTEMPT:",
            `${attempt}/${MAX_RETRIES}`
        );

        console.log(
            "=============================================="
        );

        try {

            const response =
                await ai.models.generateContent({

                    model:
                        GEMINI_MODEL,

                    contents:
                        prompt,

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


            if (
                !response ||
                !response.text
            ) {

                const emptyError =
                    new Error(
                        "Gemini returned an empty response."
                    );

                emptyError.status = 502;

                emptyError.code =
                    "GEMINI_EMPTY_RESPONSE";

                throw emptyError;
            }


            console.log(
                "=============================================="
            );

            console.log(
                "========== GEMINI SUCCESS =========="
            );

            console.log(
                "=============================================="
            );


            return response;


        } catch (error) {

            const status =
                Number(error?.status);

            const message =
                String(error?.message || "");


            console.error(
                "=============================================="
            );

            console.error(
                "========== GEMINI ERROR =========="
            );

            console.error(
                "MODEL:",
                GEMINI_MODEL
            );

            console.error(
                "STATUS:",
                status
            );

            console.error(
                "MESSAGE:",
                message
            );

            console.error(
                "=============================================="
            );


            // =========================================
            // 429 - QUOTA
            // =========================================

            if (
                status === 429 ||
                message.includes(
                    "RESOURCE_EXHAUSTED"
                ) ||
                message
                    .toLowerCase()
                    .includes(
                        "quota exceeded"
                    )
            ) {

                const quotaError =
                    new Error(
                        "Gemini quota has been exceeded. Please try again after the quota resets."
                    );

                quotaError.status = 429;

                quotaError.code =
                    "GEMINI_QUOTA_EXCEEDED";

                console.error(
                    "❌ Gemini quota exceeded."
                );

                console.error(
                    "❌ No retry will be attempted."
                );

                throw quotaError;
            }


            // =========================================
            // 401 - API KEY
            // =========================================

            if (status === 401) {

                const authError =
                    new Error(
                        "Gemini API key is invalid or authentication failed."
                    );

                authError.status = 401;

                authError.code =
                    "GEMINI_AUTH_ERROR";

                throw authError;
            }


            // =========================================
            // 403 - PERMISSION
            // =========================================

            if (status === 403) {

                const permissionError =
                    new Error(
                        "Gemini API access is not permitted for this API key."
                    );

                permissionError.status = 403;

                permissionError.code =
                    "GEMINI_PERMISSION_ERROR";

                throw permissionError;
            }


            // =========================================
            // 404 - MODEL
            // =========================================

            if (status === 404) {

                const modelError =
                    new Error(
                        `Gemini model "${GEMINI_MODEL}" is unavailable.`
                    );

                modelError.status = 404;

                modelError.code =
                    "GEMINI_MODEL_ERROR";

                throw modelError;
            }


            // =========================================
            // 503 - TEMPORARILY UNAVAILABLE
            // =========================================

            if (status === 503) {

                if (
                    attempt < MAX_RETRIES
                ) {

                    const delay =
                        attempt * 3000;

                    console.log(
                        `⚠️ Gemini is busy. Retrying in ${delay / 1000} seconds...`
                    );


                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                delay
                            )
                    );


                    continue;
                }


                const unavailableError =
                    new Error(
                        "Gemini is temporarily unavailable. Please try again later."
                    );

                unavailableError.status =
                    503;

                unavailableError.code =
                    "GEMINI_UNAVAILABLE";

                throw unavailableError;
            }


            // =========================================
            // OTHER ERROR
            // =========================================

            throw error;
        }
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


    const prompt = `

You are an expert technical interviewer and career coach.

Analyze the candidate using ONLY the information provided.

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
        "question"
    ],

    "behavioral_interview_questions": [
        "question"
    ],

    "missing_skills": [
        "skill"
    ],

    "skill_gap_severity": [
        "low"
    ],

    "preparation_plan": [
        "Day 1: topic and tasks"
    ]
}


RULES:

- match_score must be between 0 and 100.
- Generate exactly 10 technical questions.
- Generate exactly 5 behavioral questions.
- Generate up to 5 missing skills.
- skill_gap_severity must correspond to missing_skills.
- Generate exactly 7 preparation plan items.
- Do not invent candidate experience.
- Use only information present in resume and self description.
- Tailor questions to the job description.
- Questions should be realistic interview questions.
- Preparation steps should be practical.
- Return ONLY JSON.

`;


    try {

        const response =
            await generateGeminiContent(
                prompt
            );


        let result;


        try {

            result =
                JSON.parse(
                    response.text
                );

        } catch (jsonError) {

            const error =
                new Error(
                    "Gemini returned invalid JSON."
                );

            error.status = 502;

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
                            "To evaluate technical knowledge and practical understanding.",

                        answer:
                            "Explain the concept clearly and provide a practical example from your project experience."

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
                            "To evaluate communication, teamwork, adaptability and problem-solving ability.",

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
                ? result
                    .missing_skills
                    .map((skill, index) => {

                        const severity =
                            String(
                                result
                                    .skill_gap_severity?.[index] ||
                                "medium"
                            )
                                .toLowerCase();


                        return {

                            skill:
                                String(skill),

                            severity:
                                [
                                    "low",
                                    "medium",
                                    "high"
                                ].includes(severity)
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
                ? result
                    .preparation_plan
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
                                    match[2]
                                        .trim()
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


        matchScore =
            Math.max(
                0,
                Math.min(
                    100,
                    matchScore
                )
            );


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
            "=============================================="
        );

        console.log(
            "✅ INTERVIEW REPORT GENERATED"
        );

        console.log(
            "=============================================="
        );


        return validatedReport;

    } catch (error) {

        console.error(
            "========== INTERVIEW REPORT ERROR =========="
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

                format: "A4",

                printBackground: true,

                margin: {

                    top: "15mm",

                    bottom: "15mm",

                    left: "15mm",

                    right: "15mm"

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

    const prompt = `

Create a professional ATS-friendly resume.

JOB DESCRIPTION:
${jobDescription || "Not provided"}

CURRENT RESUME:
${resume || "Not provided"}

SELF DESCRIPTION:
${selfDescription || "Not provided"}

RULES:

- Do not invent information.
- Use only information provided.
- Tailor the resume to the job.
- Keep it professional.
- Keep it concise.
- Use simple HTML.
- Use proper headings.
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

            error.status = 502;

            error.code =
                "GEMINI_INVALID_RESUME_JSON";

            throw error;
        }


        const validatedContent =
            resumePdfSchema.parse(
                jsonContent
            );


        return await generatePdfFromHtml(
            validatedContent.html
        );

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