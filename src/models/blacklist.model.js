const mongoose = require('mongoose')


const blackListTokenSchema = new mongoose.Schema({
    token:{
        type:String,
        require:[true,"token is require to be added in blacklist"]
    }  
},{
    timestamps:true
})

const tokenBlacklistModel = mongoose.model("blacklistTokens",blackListTokenSchema)

module.exports = tokenBlacklistModel