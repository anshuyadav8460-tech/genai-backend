const mongoose = require("mongoose");

async function connecToDB() {
    try {

        await mongoose.connect(process.env.MONGO_URI);

        console.log("Connected to Database");
        console.log("Database Name:", mongoose.connection.name);
        console.log("Database Host:", mongoose.connection.host);

    } catch (err) {
        console.log(err);
    }
}

module.exports = connecToDB;