//Here we store the schema and model for each collection
//Imported into our app when we need it
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database
const User = require('./user')
//We need to create a Mongoose model to store our data in MongoDB, say for each user
//Model == Table Entry, MongoDB Collection == Table
//Models require a collection name to store in, and a Schema
const matchSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        crossIndustry: {
            type: Boolean,
            default: false,
        },
        threshold: {
            type: Number,
            default: 0,
        },
        location: {
            type: String,
            required: true
        },
        matchedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            required: 'Date is required'
        }
    },
    {
        collection: 'users'
    }
);

//Change the implicit '_id' field to just 'id' for ease with front-end
//This is by done by creating a virtual 'id' field that stores the HexString of the _id
matchSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
matchSchema.set('toJSON', {virtuals: true,});

//With our Schema, we can create a Model
exports.Match = mongoose.model('matches', matchSchema);