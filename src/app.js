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
app.use(
    cors({
        origin: "http://localhost:5173",
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
