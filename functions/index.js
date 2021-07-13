const functions = require("firebase-functions");
const {admin} = require("./utils/admin");
const express = require("express");
const App = express();
// const cors = require('cors');
// App.use(cors());

const {
  deleteUserByUID,
  deleteUsersByUID,
  createAuthUser,
  updateFullAuthUser,
  promoteToAdmin,
} = require('./handlers/Users');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
// //
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// App.post('/createAuth', createAuthUser);
// App.put('/updateAuth/:uid', updateFullAuthUser);
// App.post('/deleteUser/:uid', deleteUserByUID);
// App.post('/deleteUsers', deleteUsersByUID);//Pass List of UIDs in req.body.body

// exports.api = functions.region('us-central1').https.onRequest(App);
exports.deleteUser = functions.https.onCall(deleteUserByUID);
exports.deleteUsers = functions.https.onCall(deleteUsersByUID);
exports.promoteUserToAdmin = functions.https.onCall(promoteToAdmin);
exports.scheduleFunction = functions.pubsub.schedule('* * * * *').onRun((context) => {
  let updates = {}
  updates['/time'] = Math.random();
  admin.database().ref().update(updates);
  console.log('This will be run every minute!');
  return null;
});