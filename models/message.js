//Here we store the schema and model for each collection
//Imported into our app when we need it
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database
const User = require('./user')
//We need to create a Mongoose model to store our data in MongoDB, say for each user
//Model == Table Entry, MongoDB Collection == Table
//Models require a collection name to store in, and a Schema
const messageSchema = mongoose.Schema(
    {
        isSeen: {
            type: Boolean,
            default: false,
        },
        media: {
            type: String,
            default: "",
        },
        text: {
            type: String,
            required: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            required: 'Date is required'
        }
    },
    {
        collection: 'messages'
    }
);

//Change the implicit '_id' field to just 'id' for ease with front-end
//This is by done by creating a virtual 'id' field that stores the HexString of the _id
messageSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
messageSchema.set('toJSON', {virtuals: true,});

//With our Schema, we can create a Model
exports.Message = mongoose.model('matches', messageSchema);