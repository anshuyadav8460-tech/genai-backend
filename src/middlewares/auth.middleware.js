const jwt = require("jsonwebtoken");
const tokenBlacklistModel = require("../models/blacklist.model");

async function authUser(req, res, next) {

    try {

        const token = req.cookies?.token;

        console.log("========== AUTH MIDDLEWARE ==========");
        console.log("COOKIE TOKEN EXISTS:", !!token);

        if (!token) {
            return res.status(401).json({
                message: "Token not provided"
            });
        }

        const isTokenBlackListed = await tokenBlacklistModel.findOne({
            token
        });

        if (isTokenBlackListed) {
            return res.status(401).json({
                message: "Token is invalid"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        console.log("AUTH SUCCESS:", req.user.id);

        next();

    } catch (error) {

        console.error("AUTH ERROR:", error.message);

        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

module.exports = {
    authUser
};