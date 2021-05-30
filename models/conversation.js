//Here we store the schema and model for each collection
//Imported into our app when we need it
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database
const User = require('./user')
const Message = require('./message')
//We need to create a Mongoose model to store our data in MongoDB, say for each user
//Model == Table Entry, MongoDB Collection == Table
//Models require a collection name to store in, and a Schema
const conversationSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        image: {
            type: String, //URL
            lowercase: true
        },
        messageList: [{
            type: mongoose.Schema.Types.ObjectId,
            default: [],
        }],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message'
        },
        matchedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
    },
    {
        collection: 'conversation'
    }
);

//Change the implicit '_id' field to just 'id' for ease with front-end
//This is by done by creating a virtual 'id' field that stores the HexString of the _id
conversationSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
conversationSchema.set('toJSON', {virtuals: true,});

//With our Schema, we can create a Model
exports.Conversation = mongoose.model('conversations', conversationSchema);