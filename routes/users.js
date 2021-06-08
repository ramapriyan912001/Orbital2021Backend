//Import the Model and Express
const _ = require('lodash');
const express = require('express');
const mongoose = require('mongoose');
const {User} = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {chatRoom, Chatroom} = require('../models/chatroom')

//Initialise the Router to create backend APIs
const router = express.Router();

//Factory method to construct Users
const typicalUser = (req) => new User({
    name: req.body.name,
    dob: req.body.dob,
    email: req.body.email,
    passwordhash: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(4)),
    isAdmin: req.body.isAdmin,
    image: req.body.image,
    diet: req.body.diet,
    cuisine:  req.body.cuisine,
    crossIndustry: req.body.crossIndustry,
    isOnline: req.body.isOnline,
    lastSeen: req.body.lastSeen,
    chats: new Chatroom()
});

//API for GET
//When we want to return ALL data from our MongoDB databse, we need to use our Mongoose model and return .find()
router.get(`/`, (req, res) => {
    let filter = {};//Initially filter is an empty collection
    
    //This is if we need to filter certain queries out -> Specific Query GETs
    // if (req.query.products) {//If there are product queries, i.e., we want to filter out all user who like a certain product, then this code runs
    //     //the uri is goint to be like http://localhost:3000/api/v1/user?product=123,787 -> where 123, 787 are the codes for the products we want to filter by
    //     filter = {product: req.query.products.split(',')};//this part splits each entry of the query by comma and adds into an array, which is assigned to our filter
    // }

    User.find(filter).select('-passwordhash')//Making it async and using await == Using promise .then() and .catch()
    //.select() chooses the fields we want to send, e.g.  -dob -> don't send date of birth back
    .then(foundUser => 
        foundUser
        ? res.status(200).json({user: foundUser, success:true})
        : res.status(400).json({message: 'No records found', success: false})
    )
    .catch(err =>
        res.status(500).json({
            success: false,
            error: err
        }));
});

//API for GET to find by given ID
router.get(`/:id`, (req, res) => {
    //Validate User's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({message: 'Invalid User ID',success: false});
    }
    //Making it async and using await == Using promise .then() and .catch()
    User.findById(req.params.id).select('-passwordhash')//.populate('product') -> shows details of field in blank (provided they are referenced)
    .then((foundUser) => {
        if (!foundUser) {//Analogous to .catch()
            res.status(400).json({message: 'Not Found!', success:true});
        } else {
            res.status(200).json({
                user: foundUser,
                success: true
            });
        }
    }).catch((err) => {
        res.status(500).json({
            error: err,
            success: false
        })
    });
});

router.get(`/:id/lastseen`, (req, res) => {
    //Validate User's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({message: 'Invalid User ID', success: false});
    }
    //Making it async and using await == Using promise .then() and .catch()
    User.findById(req.params.id).select('lastSeen')//.populate('product') -> shows details of field in blank (provided they are referenced)
    .then((foundUser) => {
        if (!foundUser) {//Analogous to .catch()
            res.status(400).json({
                message: 'Not Found!',
                success: false
            });
        } else {
            res.status(200).json({
                user: foundUser,
                success: true
        });
        }
    }).catch((err) => {
        res.status(500).json({
            error: err,
            success: false
        })
    });
});

//API for GET to retrieve count statistics of number of Users
router.get('/get/count', (req, res) => {
    User.estimatedDocumentCount(count => count) //use countDocuments() when you want to countDocuments by some filtered field
    .then(value => res.status(200).json({
        count: value.toString(),
        success: true
    }))
    .catch(err => res.status(500).json({
        error: err,
        success: false
    }));
});

//API for Logins through POST
//User logs into localhost:process.env.PORT/api/v1/users/login/ with email to get authenticated
router.post(`/login`, async (req, res) => {
    User
    .findOne({email: req.body.body.email})
    .then(foundUser => {
        if (!foundUser) {
            return res.status(401).json({
                message: 'Invalid Email',
                success: false,
            })
        }
        //e-mail valid, authenticate password and issue jwt

        if (foundUser && bcrypt.compareSync(req.body.body.password, foundUser.passwordhash)) {
            const token = jwt.sign(
                {
                    userID: foundUser.id,
                    isAdmin: foundUser.isAdmin,//Pass this info along with the jwt
                },
                process.env.tokenSecret,
                {
                    expiresIn: '1w'//1d -> 1 day, 1w -> 1 week
                }
            );
            return res.status(200).json({
                message: 'Logged in',
                email: foundUser.email,
                isAdmin: foundUser.isAdmin,
                lastSeen: foundUser.lastSeen,
                token: token,
                success: true
            });
        } else {
            return res.status(402).json({
                message: 'Incorrect Password',
                success: false
            })
        }
    })
    .catch(err => res.status(500).json({
        error: err,
        success: false
    }));
});

//API for Registering New Users through POST
//User registers into localhost:3000/api/v1/users/register/ with email to get authenticated
router.post(`/register`, (req, res) => {
<<<<<<< Updated upstream
    
    let userToRegister = typicalUser(req); //For this to work, the frontend must send JSON fields with the exact same labels
=======
    let userToRegister = typicalUser(req.body); //For this to work, the frontend must send JSON fields with the exact same labels
>>>>>>> Stashed changes

    userToRegister
    .save()
    .then((createdUser) => 
        createdUser
        ? res.status(200).json({
        createdUser,
        success: true
    })
        : res.status(400).json({
            message: 'Bad Request',
            success: false
        })
    )//return created user in json form by showing us 201 code for success
    .catch((err) => {
        console.log(err);
        res.status(500).json({
        error: err,
        success: false})//return an error JSON showing the error and that the success is not true, after showing us error code 500 for failure
    });
});

//API for Delete
//Notice that now our call link should include the objectID, which we use through req.params.id to find and delete
router.delete(`/:id`, (req, res) => {
    //Validate User's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).send('Invalid User ID');
    }
    User.findByIdAndDelete(req.params.id).then((user) => {
        if (user) {
            res.status(201).json({
                success: true,
                message: "User is deleted"
            });
        } else {
            res.status(404).json({
                success: false,
                message: "User not found"
            })};
        }).catch(err => res.status(500).json({
                success: false,
                error: err
        }));
});

//API for Updates (Put)
router.put(`/:id`, (req, res) => {
    //Validate User's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).send('Invalid User ID');
    }

    User
    .findByIdAndUpdate(
        req.params.id, 
        {
            name: req.body.name,
            dob: req.body.dob,
            email: req.body.email,
            passwordhash: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(4)),
            postal: req.body.postal,
            phone: req.body.phone,
            isAdmin: req.body.isAdmin,
            image: req.body.image,
            diet: req.body.diet,
            cuisine:  req.body.cuisine,
            crossIndustry: req.body.crossIndustry,
            isOnline: req.body.isOnline,
            lastSeen: req.body.lastSeen
        })
    .then((user) => {
        user.save();
        if (user) {
            res.status(200).json({
                user,
                success: true,
            })
        } else {
            res.status(400).json({
                message:'Could not update',success: false
            })
        }
    })
    .catch((err) =>
        res.status(500).json({
            error: err,
            success: false,
        }));
});

//API for Updates (Put)
router.put(`/:id/lastseen`, (req, res) => {
    //Validate User's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({
            message: 'Invalid User ID',
            success: false
        });
    //This line below is a reminder of how javascript is truly a moronic language - code to check if an object is a date object
    // } else if (req.body.lastSeen.prototype.toString.call(date) !== '[object Date]') {
    } 

    User
    .findByIdAndUpdate(
        req.params.id, 
        {
            lastSeen: req.body.lastSeen
        },
        {
            useFindAndModify: false,
            returnOriginal: false
        })
    .then((user) => {
        user
        .save()
        .then(user => user
            ?
            res.status(200).json({
                user,
                success: true})
            :
            res.status(400).json({
                message: 'Could not update last seen',
                success: false
            })
        .catch((err) =>
            res.status(500).json({
                error: err,
                success: false,
        }))
        )})
    .catch((err) =>
        res.status(500).json({
            error: err,
            success: false,
        }));
});

module.exports = router;