//Entry Point for Application - All required Libraries
//Equivalent to import statements for all required libraries
const express = require('express');//Calls the expressJS library
const app = express();//Calls the expressJS functions
const morgan = require('morgan');//logging operations with 'morgan'
const mongoose = require('mongoose');//mongoose used to connect to our MongoDB database
const cors = require('cors');//Cross Origin Resource Sharing
const authJwt = require('./helpers/jwt');
const auth_error = require('./helpers/auth_error');

//To use .env variables in our app
require('dotenv/config');
//Access environmental variables with process.env._______

const api = process.env.API_URL;//Stores our API_URL data

//Import all Routes (which have the Models inside them)
const User = require('./routes/users');

//Middleware - Needed to parse data in the form of JSON, now if app requests pass JSON it will be parsed

app.use(express.json());
//We can use morgan with a 'tiny' option (default) so it will log our operations
app.use(morgan('tiny'));
//Use Middleware helper function to authenticate json web tokens
app.use(authJwt());
//Error Handling for Authentication
app.use(auth_error);
//Make Upload path static -> Photo Uploads
// app.use(`/${process.env.UPLOAD_PATH}`, express.static(__dirname + `/${process.env.UPLOAD_PATH}`));
//Enable CORS
app.use(cors());
app.options('*', cors());//* -> all, as in All Requests are permitted to use CORS

//Use created routers
app.use(`${api}/users`, User);

//Connect to our MongoDB database - using mongoose. Obtain server URI from MongoDB and fill in username, pw and db name
mongoose.connect(
    process.env.MONGODB_CONNECTION,
    {useNewUrlParser: true,
    useUnifiedTopology: true})
    .then(() => {//Like a map for completedFuture -> connect() returns a 'promise'
        console.log("Database is connected...");
    })
    .catch((err) => {//Like a catch errors for the promise
        console.log(err);
    });
    
app.listen(process.env.PORT, () => console.log("This is the callback message printed in terminal when the server http://localhost:" + process.env.PORT + " is started"));