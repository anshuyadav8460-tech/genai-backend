const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");


// =====================================================
// GEMINI AI CONFIGURATION
// =====================================================

const API_KEY = process.env.GOOGLE_GENAI_API_KEY;

const MODEL = "gemini-3.6-flash";


// =====================================================
// API KEY CHECK
// =====================================================

if (!API_KEY) {
    console.error(
        "❌ GOOGLE_GENAI_API_KEY is missing from environment variables."
    );
} else {
    console.log(
        "✅ GOOGLE_GENAI_API_KEY loaded successfully."
    );
}


// =====================================================
// GEMINI CLIENT
// =====================================================

const ai = new GoogleGenAI({
    apiKey: API_KEY
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
// SLEEP
// =====================================================

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// =====================================================
// CLEAN GEMINI JSON
// =====================================================

function cleanJsonResponse(text) {

    if (!text) {
        throw new Error(
            "Gemini returned an empty response."
        );
    }

    let cleaned = String(text).trim();


    // Remove ```json
    if (cleaned.startsWith("```json")) {

        cleaned = cleaned
            .replace(/^```json\s*/i, "")
            .replace(/\s*```$/i, "");

    }


    // Remove normal ```
    else if (cleaned.startsWith("```")) {

        cleaned = cleaned
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "");

    }


    return cleaned.trim();
}


// =====================================================
// GEMINI ERROR MESSAGE
// =====================================================

function getGeminiErrorMessage(error) {

    const status =
        Number(
            error?.status ||
            error?.response?.status ||
            0
        );


    const originalMessage =
        error?.message ||
        error?.response?.data?.error?.message ||
        "Unknown Gemini API error.";


    // 401
    if (status === 401) {

        return new Error(
            "Gemini API authentication failed. Please check GOOGLE_GENAI_API_KEY."
        );

    }


    // 403
    if (status === 403) {

        return new Error(
            "Gemini API access is forbidden. Please check your Google AI API project permissions."
        );

    }


    // 404
    if (status === 404) {

        return new Error(
            `Gemini model "${MODEL}" is not available for this API project.`
        );

    }


    // 429
    if (status === 429) {

        return new Error(
            "Gemini free quota has been exceeded. Please wait until the quota resets and try again."
        );

    }


    // 5xx
    if (status >= 500 && status <= 599) {

        return new Error(
            "Gemini server is temporarily unavailable. Please try again later."
        );

    }


    return new Error(
        originalMessage
    );

}


// =====================================================
// GEMINI GENERATION
// =====================================================

async function generateGeminiContent(
    prompt,
    options = {}
) {

    // -------------------------------------------------
    // API KEY CHECK
    // -------------------------------------------------

    if (!API_KEY) {

        throw new Error(
            "GOOGLE_GENAI_API_KEY is not configured."
        );

    }


    console.log(
        "=============================================="
    );

    console.log(
        "========== CALLING GEMINI =========="
    );

    console.log(
        "API KEY EXISTS:",
        Boolean(API_KEY)
    );

    console.log(
        "MODEL:",
        MODEL
    );

    console.log(
        "=============================================="
    );


    // -------------------------------------------------
    // ONLY RETRY SERVER ERRORS
    // NEVER RETRY 429
    // -------------------------------------------------

    const MAX_RETRIES = 2;

    let lastError = null;


    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {

        try {

            console.log(
                "========== GEMINI TRY =========="
            );

            console.log(
                "Model:",
                MODEL
            );

            console.log(
                "Attempt:",
                attempt
            );

            console.log(
                "=================================="
            );


            // -------------------------------------------------
            // GEMINI REQUEST
            // -------------------------------------------------

            const response =
                await ai.models.generateContent({

                    model: MODEL,

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
            // EMPTY RESPONSE CHECK
            // -------------------------------------------------

            if (!response) {

                throw new Error(
                    "Gemini returned no response."
                );

            }


            const responseText =
                typeof response.text === "function"
                    ? response.text()
                    : response.text;


            if (
                !responseText ||
                !String(responseText).trim()
            ) {

                throw new Error(
                    "Gemini returned an empty response."
                );

            }


            // -------------------------------------------------
            // SUCCESS
            // -------------------------------------------------

            console.log(
                "========== GEMINI SUCCESS =========="
            );

            console.log(
                "Model:",
                MODEL
            );

            console.log(
                "======================================"
            );


            return {
                ...response,
                text: String(responseText).trim()
            };

        } catch (error) {

            lastError = error;


            const status =
                Number(
                    error?.status ||
                    error?.response?.status ||
                    0
                );


            console.error(
                "========== GEMINI ERROR =========="
            );

            console.error(
                "Model:",
                MODEL
            );

            console.error(
                "Attempt:",
                attempt
            );

            console.error(
                "Status:",
                status
            );

            console.error(
                "Message:",
                error?.message
            );

            console.error(
                "=================================="
            );


            // =================================================
            // 401
            // =================================================

            if (status === 401) {

                throw getGeminiErrorMessage(error);

            }


            // =================================================
            // 403
            // =================================================

            if (status === 403) {

                throw getGeminiErrorMessage(error);

            }


            // =================================================
            // 404
            // =================================================

            if (status === 404) {

                throw getGeminiErrorMessage(error);

            }


            // =================================================
            // 429
            // =================================================
            // IMPORTANT:
            // DO NOT RETRY QUOTA ERROR
            // =================================================

            if (status === 429) {

                console.error(
                    "❌ Gemini quota exceeded."
                );

                console.error(
                    "❌ No retry will be attempted."
                );

                throw getGeminiErrorMessage(error);

            }


            // =================================================
            // SERVER ERRORS
            // =================================================

            const serverError =
                status === 500 ||
                status === 502 ||
                status === 503 ||
                status === 504;


            if (
                serverError &&
                attempt < MAX_RETRIES
            ) {

                const delay =
                    attempt * 3000;


                console.log(
                    `⚠️ Temporary Gemini server error. Retrying after ${delay}ms...`
                );


                await sleep(delay);

                continue;

            }


            // =================================================
            // UNKNOWN ERROR
            // =================================================

            throw getGeminiErrorMessage(error);

        }

    }


    throw getGeminiErrorMessage(
        lastError ||
        new Error("Gemini request failed.")
    );

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
    // INPUT VALIDATION
    // =================================================

    if (
        !jobDescription ||
        !String(jobDescription).trim()
    ) {

        throw new Error(
            "Job description is required."
        );

    }


    if (
        !selfDescription ||
        !String(selfDescription).trim()
    ) {

        throw new Error(
            "Self description is required."
        );

    }


    if (
        !resume ||
        !String(resume).trim()
    ) {

        throw new Error(
            "Resume information is required."
        );

    }


    // =================================================
    // PROMPT
    // =================================================

    const prompt = `

You are an expert technical interviewer,
career coach and recruitment specialist.

Analyze the candidate using ONLY the information
provided below.

========================================
JOB DESCRIPTION
========================================

${jobDescription}


========================================
RESUME
========================================

${resume}


========================================
SELF DESCRIPTION
========================================

${selfDescription}


========================================
TASK
========================================

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


========================================
RULES
========================================

1. match_score must be between 0 and 100.

2. Generate exactly 10 technical interview questions.

3. Generate exactly 5 behavioral interview questions.

4. Generate up to 5 important missing skills.

5. skill_gap_severity must correspond to missing_skills.

6. Generate exactly 7 preparation plan items.

7. Do NOT invent candidate experience.

8. Only use information present in the resume
   and self description.

9. Tailor questions to the job description.

10. Questions should be realistic for an actual
    technical interview.

11. Preparation steps should be practical.

12. Return ONLY JSON.

13. Do not return markdown.

14. Do not return code fences.

`;


    try {

        // =================================================
        // CALL GEMINI
        // =================================================

        const response =
            await generateGeminiContent(
                prompt
            );


        console.log(
            "========== GEMINI RESPONSE RECEIVED =========="
        );


        console.log(
            response.text
        );


        // =================================================
        // CLEAN JSON
        // =================================================

        const cleanedJson =
            cleanJsonResponse(
                response.text
            );


        // =================================================
        // PARSE JSON
        // =================================================

        let result;

        try {

            result =
                JSON.parse(
                    cleanedJson
                );

        } catch (jsonError) {

            console.error(
                "❌ GEMINI JSON PARSE ERROR"
            );

            console.error(
                cleanedJson
            );

            throw new Error(
                "Gemini returned invalid JSON."
            );

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
                    .filter(Boolean)
                    .map(question => ({

                        question:
                            String(question),

                        intention:
                            "To evaluate the candidate's technical understanding and practical knowledge.",

                        answer:
                            "Explain the concept clearly, give a practical example from your project experience, and describe how you would implement it."

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
                    .filter(Boolean)
                    .map(question => ({

                        question:
                            String(question),

                        intention:
                            "To evaluate communication, teamwork, problem-solving and professional behavior.",

                        answer:
                            "Answer using a real project or academic example. Explain the situation, your action and the result."

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
                    .filter(Boolean)
                    .slice(0, 5)
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
                    .filter(Boolean)
                    .slice(0, 7)
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
                                    Number(match[1]),

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
        // MATCH SCORE
        // =================================================

        let matchScore =
            Number(
                result.match_score
            );


        if (
            !Number.isFinite(matchScore)
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


        // =================================================
        // TITLE
        // =================================================

        const title =
            String(
                result.job_role ||
                "Interview Preparation Plan"
            );


        // =================================================
        // FINAL REPORT
        // =================================================

        const interviewReport = {

            title,

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
            "========== FINAL INTERVIEW REPORT =========="
        );


        console.log(
            JSON.stringify(
                validatedReport,
                null,
                2
            )
        );


        console.log(
            "=============================================="
        );


        return validatedReport;


    } catch (error) {

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
            "STACK:",
            error?.stack
        );

        console.error(
            "=============================================="
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

    let browser = null;


    try {

        if (
            !htmlContent ||
            !String(htmlContent).trim()
        ) {

            throw new Error(
                "HTML content is empty."
            );

        }


        // =================================================
        // LAUNCH PUPPETEER
        // =================================================

        browser =
            await puppeteer.launch({

                headless: true,

                args: [

                    "--no-sandbox",

                    "--disable-setuid-sandbox",

                    "--disable-dev-shm-usage",

                    "--disable-gpu"

                ]

            });


        // =================================================
        // PAGE
        // =================================================

        const page =
            await browser.newPage();


        // =================================================
        // HTML
        // =================================================

        await page.setContent(

            String(htmlContent),

            {
                waitUntil:
                    "networkidle0"
            }

        );


        // =================================================
        // PDF
        // =================================================

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


        if (
            !pdfBuffer ||
            pdfBuffer.length === 0
        ) {

            throw new Error(
                "Puppeteer generated an empty PDF."
            );

        }


        console.log(
            "✅ PDF generated successfully."
        );


        return pdfBuffer;


    } catch (error) {

        console.error(
            "========== PDF GENERATION ERROR =========="
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


        throw error;


    } finally {

        // =================================================
        // CLOSE BROWSER
        // =================================================

        if (browser) {

            try {

                await browser.close();

            } catch (closeError) {

                console.error(
                    "Puppeteer browser close error:",
                    closeError?.message
                );

            }

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

    // =================================================
    // VALIDATION
    // =================================================

    if (
        !resume ||
        !String(resume).trim()
    ) {

        throw new Error(
            "Resume information is required."
        );

    }


    // =================================================
    // PROMPT
    // =================================================

    const prompt = `

You are an expert professional resume writer.

Create a professional ATS-friendly resume.

========================================
JOB DESCRIPTION
========================================

${jobDescription || "Not provided"}


========================================
CURRENT RESUME
========================================

${resume || "Not provided"}


========================================
SELF DESCRIPTION
========================================

${selfDescription || "Not provided"}


========================================
REQUIREMENTS
========================================

- Tailor the resume to the job description.
- Do NOT invent information.
- Do NOT invent companies.
- Do NOT invent job titles.
- Do NOT invent education.
- Do NOT invent skills that are not supported.
- Keep the content professional.
- Keep it concise.
- Prefer 1-2 pages.
- Use simple HTML.
- Make it ATS-friendly.
- Use proper headings.
- Highlight relevant technical skills.
- Include projects only when provided.
- Include experience only when provided.
- Return ONLY valid JSON.
- JSON must contain exactly one field named "html".
- Do NOT return markdown.
- Do NOT return code fences.

`;


    try {

        console.log(
            "========== GENERATING RESUME PDF =========="
        );


        // =================================================
        // GEMINI
        // =================================================

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


        // =================================================
        // CLEAN JSON
        // =================================================

        const cleanedJson =
            cleanJsonResponse(
                response.text
            );


        // =================================================
        // PARSE JSON
        // =================================================

        let jsonContent;


        try {

            jsonContent =
                JSON.parse(
                    cleanedJson
                );

        } catch (jsonError) {

            console.error(
                "❌ RESUME JSON PARSE ERROR"
            );

            console.error(
                cleanedJson
            );

            throw new Error(
                "Gemini returned invalid resume JSON."
            );

        }


        // =================================================
        // ZOD VALIDATION
        // =================================================

        const validatedContent =
            resumePdfSchema.parse(
                jsonContent
            );


        // =================================================
        // GENERATE PDF
        // =================================================

        const pdfBuffer =
            await generatePdfFromHtml(
                validatedContent.html
            );


        if (
            !pdfBuffer ||
            pdfBuffer.length === 0
        ) {

            throw new Error(
                "Resume PDF buffer is empty."
            );

        }


        console.log(
            "========== RESUME PDF SUCCESS =========="
        );


        return pdfBuffer;


    } catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "RESUME PDF GENERATION ERROR"
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
            "STACK:",
            error?.stack
        );

        console.error(
            "=============================================="
        );


        // IMPORTANT:
        // Don't hide the original error.
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