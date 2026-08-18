const express = require("express");
const authRouter = require("./routes/auth.routes");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const interviewRouter = require("./routes/interview.routes");

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS
const allowedOrigins = [
    "http://localhost:5173",
    "https://genai-frontend-d1j4.onrender.com"
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true
    })
);

// Home route
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Interview Master Backend is running successfully"
    });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

module.exports = app;