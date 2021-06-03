//Here we store the schema and model for each collection
//Imported into our app when we need it
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database

//We need to create a Mongoose model to store our data in MongoDB, say for each user
//Model == Table Entry, MongoDB Collection == Table
//Models require a collection name to store in, and a Schema
const chatroomSchema = mongoose.Schema(
    {
        conversations: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation'
        }],
    },
    {
        collection: 'chatroom'
    }
);

//Change the implicit '_id' field to just 'id' for ease with front-end
//This is by done by creating a virtual 'id' field that stores the HexString of the _id
chatroomSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
chatroomSchema.set('toJSON', {virtuals: true,});

//With our Schema, we can create a Model
exports.Chatroom = mongoose.model('chatroom', chatroomSchema);