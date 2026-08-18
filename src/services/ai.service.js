const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");


// =====================================================
// GEMINI AI
// =====================================================

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
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
// SLEEP
// =====================================================

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// =====================================================
// GEMINI GENERATION WITH RETRY
// =====================================================

async function generateGeminiContent(prompt, options = {}) {

    const models = [
        "gemini-2.5-flash"
    ];

    let lastError = null;

    for (const model of models) {

        for (let attempt = 1; attempt <= 3; attempt++) {

            try {

                console.log(
                    `========== GEMINI TRY ==========
Model: ${model}
Attempt: ${attempt}
==================================`
                );

                const response =
                    await ai.models.generateContent({

                        model,

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


                if (!response?.text) {

                    throw new Error(
                        "Gemini returned an empty response."
                    );

                }


                console.log(
                    `========== GEMINI SUCCESS ==========
Model: ${model}
======================================`
                );


                return response;

            } catch (error) {

                lastError = error;

                console.error(
                    "========== GEMINI ERROR =========="
                );

                console.error(
                    "Model:",
                    model
                );

                console.error(
                    "Attempt:",
                    attempt
                );

                console.error(
                    "Status:",
                    error?.status
                );

                console.error(
                    "Message:",
                    error?.message
                );


                const status =
                    Number(error?.status);


                const temporaryError =
                    status === 429 ||
                    status === 500 ||
                    status === 502 ||
                    status === 503 ||
                    status === 504;


                if (!temporaryError) {

                    throw error;

                }


                if (attempt < 3) {

                    const delay =
                        attempt * 2000;

                    console.log(
                        `Retrying after ${delay}ms...`
                    );

                    await sleep(delay);

                }

            }
        }

    }


    throw lastError ||
        new Error(
            "All Gemini models failed."
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
        "========== CALLING GEMINI =========="
    );

    console.log(
        "API KEY EXISTS:",
        !!process.env.GOOGLE_GENAI_API_KEY
    );


    const prompt = `

You are an expert technical interviewer and career coach.

Analyze the candidate based on the following information.

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
- Generate exactly 10 technical interview questions.
- Generate exactly 5 behavioral interview questions.
- Generate up to 5 important missing skills.
- skill_gap_severity must match missing_skills.
- Generate exactly 7 preparation plan items.
- Do not invent candidate experience.
- Only use information present in the resume and self description.
- Tailor questions to the job description.
- Make the questions realistic for an actual interview.
- Make preparation steps practical.
- Return ONLY JSON.

`;


    try {

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


        const result =
            JSON.parse(
                response.text
            );


        // =====================================================
        // TECHNICAL QUESTIONS
        // =====================================================

        const technicalQuestions =
            (result.technical_interview_questions || [])
                .map(question => ({

                    question:
                        String(question),

                    intention:
                        "To evaluate the candidate's technical understanding and practical knowledge.",

                    answer:
                        "Explain the concept clearly, provide a practical example from your project experience, and describe how you would implement it."

                }));


        // =====================================================
        // BEHAVIORAL QUESTIONS
        // =====================================================

        const behavioralQuestions =
            (result.behavioral_interview_questions || [])
                .map(question => ({

                    question:
                        String(question),

                    intention:
                        "To evaluate communication, teamwork, problem-solving and professional behavior.",

                    answer:
                        "Answer using a real project or academic example. Explain the situation, your action and the result."

                }));


        // =====================================================
        // SKILL GAPS
        // =====================================================

        const skillGaps =
            (result.missing_skills || [])
                .map((skill, index) => {

                    const severity =
                        String(
                            result.skill_gap_severity?.[index] ||
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
                            ].includes(severity)
                                ? severity
                                : "medium"

                    };

                });


        // =====================================================
        // PREPARATION PLAN
        // =====================================================

        const preparationPlan =
            (result.preparation_plan || [])
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
                                    .split(".")[0],

                            tasks: [
                                match[2]
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

                });


        // =====================================================
        // FINAL REPORT
        // =====================================================

        const interviewReport = {

            title:
                result.job_role ||
                "Interview Preparation Plan",

            matchScore:
                Number(
                    result.match_score || 0
                ),

            technicalQuestions,

            behavioralQuestions,

            skillGaps,

            preparationPlan

        };


        // =====================================================
        // ZOD VALIDATION
        // =====================================================

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
            "STACK:",
            error?.stack
        );


        throw error;
    }
}


// =====================================================
// GENERATE PDF FROM HTML
// =====================================================

async function generatePdfFromHtml(htmlContent) {

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
                waitUntil: "networkidle0"
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
// RESUME PDF SCHEMA
// =====================================================

const resumePdfSchema = z.object({

    html: z.string()

});


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

========================
JOB DESCRIPTION
========================

${jobDescription || "Not provided"}


========================
CURRENT RESUME
========================

${resume || "Not provided"}


========================
SELF DESCRIPTION
========================

${selfDescription || "Not provided"}


========================
REQUIREMENTS
========================

- Tailor the resume to the job description.
- Do not invent information.
- Keep the content human-written.
- Keep it professional.
- Keep it concise.
- Prefer 1-2 pages.
- Use simple HTML.
- Make it ATS friendly.
- Use proper headings.
- Highlight relevant technical skills.
- Include projects and experience only when provided.
- Return ONLY JSON.
- JSON must contain one field named "html".

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


        const jsonContent =
            JSON.parse(
                response.text
            );


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
            error
        );


        throw new Error(
            "Failed to generate resume PDF."
        );

    }

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    generateInterviewReport,

    generateResumePdf

};