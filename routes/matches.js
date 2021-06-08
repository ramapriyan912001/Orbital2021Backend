//Import the Model and Express
const express = require('express');
const mongoose = require('mongoose');
const {Match} = require('../models/match');
const jwt = require('jsonwebtoken');

//Initialise the Router to create backend APIs
const router = express.Router();

//API for GET
//When we want to return ALL data from our MongoDB database, we need to use our Mongoose model and return .find()
router.get(`/`, (req, res) => {
    let filter = {};//Initially filter is an empty collection
    
    //This is if we need to filter certain queries out -> Specific Query GETs
    // if (req.query.products) {//If there are product queries, i.e., we want to filter out all user who like a certain product, then this code runs
    //     //the uri is goint to be like http://localhost:3000/api/v1/user?product=123,787 -> where 123, 787 are the codes for the products we want to filter by
    //     filter = {product: req.query.products.split(',')};//this part splits each entry of the query by comma and adds into an array, which is assigned to our filter
    // }

    Match.find(filter).select('-passwordhash')//Making it async and using await == Using promise .then() and .catch()
    //.select() chooses the fields we want to send, e.g.  -dob -> don't send date of birth back
    .then(foundMatch => 
        foundMatch
        ? res.status(200).send(foundMatch)
        : res.status(400).send('No records found')
    )
    .catch(err =>
        res.status(500).json({
            success: false,
            error: err
        }));
});

//API for GET to find by given ID
router.get(`/:id`, (req, res) => {
    //Validate Match's ObjectID
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).send('Invalid Match ID');
    }
    //Making it async and using await == Using promise .then() and .catch()
    Match.findById(req.params.id).select('-passwordhash')//.populate('product') -> shows details of field in blank (provided they are referenced)
    .then((foundMatch) => {
        if (!foundMatch) {//Analogous to .catch()
            res.status(400).send('Not Found!');
        } else {
            res.send(foundMatch);
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
    Match.estimatedDocumentCount(count => count) //use countDocuments() when you want to countDocuments by some filtered field
    .then(value => res.status(200).send(value.toString()))
    .catch(err => res.status(500).send(err));
});

//API for Logins through POST
//User logs into localhost:process.env.PORT/api/v1/users/login/ with email to get authenticated
router.post(`/login`, async (req, res) => {
    const email = req.body.email;
    console.log(email);
    if (email === null) {res.status(401).json({
        'message': 'No Email Provided',
        success: false
    })};

    User
    .findOne({email: email})
    .then(foundUser => {
        if (!foundUser) {
            return res.status(401).json({//ERROR CODE 401 is for invalid email, 402 is Password
                message: 'Invalid Email',
                success: false,
            })
        }
        //e-mail valid, authenticate password and issue jwt

        if (foundUser && bcrypt.compareSync(req.body.password, foundUser.passwordhash)) {
            const token = jwt.sign(
                {
                    userID: foundUser.id,
                    isAdmin: foundUser.isAdmin,//Pass this info along with the jwt
                },
                process.env.tokenSecret,
                {
                    expiresIn: '1d'//1d -> 1 day, 1w -> 1 week
                }
            );
            return res.status(200).json({
                message: 'Logged in',
                email: foundUser.email,
                isAdmin: foundUser.isAdmin,
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
    let userToRegister = typicalUser(req); //For this to work, the frontend must send JSON fields with the exact same labels

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
        res.status(400).send('Invalid Match ID');
    }
    Match.findByIdAndDelete(req.params.id).then((user) => {
        if (user) {
            res.status(201).json({
                success: true,
                message: "Match is deleted"
            });
        } else {
            res.status(404).json({
                success: false,
                message: "Match not found"
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
        res.status(400).send('Invalid Match ID');
    }

    Match
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
                success: false
            })
        }
    })
    .catch((err) =>
        res.status(500).json({
            error: err,
            success: false,
        }));
});

module.exports = router;