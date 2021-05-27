//Here we store the schema and model for each collection
//Imported into our app when we need it
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database
const Chatroom = require('./chatroom')
//We need to create a Mongoose model to store our data in MongoDB, say for each user
//Model == Table Entry, MongoDB Collection == Table
//Models require a collection name to store in, and a Schema
const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: 'Name is required!'
        },
        dob: {
            type: Date,
            required: 'Date-Of-Birth is required!'
        },
        diet: {
            type: String,
            default: 'None'
        },
        cuisine:  [{
            type: String,
            required: 'Select your preferred cuisines'
        }],
        crossIndustry: {
            type: Boolean,
            default: false
        },
        email: {
            type: String,
            lowercase: true,
            required: 'Email is required!',
        },
        passwordhash: {
            type: String,
            required: 'Password is required!',
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        isOnline: {
            type: Boolean,
            default: false
        },
        lastSeen: {
            type: Date,
            default: Date.now
        },
        image: {
            type: String, //URL
            lowercase: true
        },
        chats: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chatroom'
        }
    },
    {
        collection: 'users'
    }
);

//Change the implicit '_id' field to just 'id' for ease with front-end
//This is by done by creating a virtual 'id' field that stores the HexString of the _id
userSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
userSchema.set('toJSON', {virtuals: true,});

//With our Schema, we can create a Model
exports.User = mongoose.model('users', userSchema);