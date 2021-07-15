const functions = require("firebase-functions");
const {admin} = require("./utils/admin");
const express = require("express");
const App = express();
// const cors = require('cors');
// App.use(cors());

const {
  makeDateString,
  findingNearestQuarterTime,
  makeDateTimeString
} = require('./handlers/MatchingHelpers')

const {
  deleteUserByUID,
  deleteUsersByUID,
  createAuthUser,
  updateFullAuthUser,
  promoteToAdmin,
  addPushTokenToDatabase,
} = require('./handlers/Users');

const {
  matchDecline,
  matchConfirm,
  findGobbleMate,
  matchUnaccept,
} = require('./handlers/Matches')

const {
  sendMessageNotif
} = require('./handlers/Chats');

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
exports.addPushTokenToDatabase = functions.https.onCall(addPushTokenToDatabase)
exports.matchDecline = functions.https.onCall(matchDecline)
exports.matchConfirm = functions.https.onCall(matchConfirm)
exports.findGobbleMate = functions.https.onCall(findGobbleMate)
exports.matchUnaccept = functions.https.onCall(matchUnaccept)
exports.sendMessageNotif = functions.https.onCall(sendMessageNotif);
// exports.scheduledMatchingFunctions = functions.pubsub.schedule('*/10 * * * *').onRun((context) => {
// })
exports.scheduleAwaitingCleanUpFunction = functions.pubsub.schedule('1-59/15 * * * *').onRun(async(context) => {
  let updates = {}
  let now = new Date();
  now.setMinutes(findingNearestQuarterTime(now))
  let todayString = makeDateString(now);
  let todayTimeString = makeDateTimeString(now)
  await admin.database().ref(`AwaitingPile/${makeDateTimeString(now)}`)
  .once("value").then(snapshot => {
    let requests = snapshot.val();
    console.log(requests)
    for(let [key, value] of Object.entries(requests)) {
      updates[`/UserRequests/${value.userId}/${key}`] = null;
      updates[`/Users/${value.userId}/awaitingMatchIDs/${key}`] = null;
      updates[`/GobbleRequests/${todayString}/${value.dietaryRestriction}`] = null;
    }
  }).catch(err => console.log("15 minute awaitingmatchIDs clean up error " + err.message))
  try {
    updates[`/AwaitingPile/${todayTimeString}`] = null
    await admin.database().ref().update(updates);
    console.log(updates)
    console.log("15 minute awaiting requests deletion complete")
  } catch(err) {
    console.log("15 minute awaiting requests deletion error " + err.message)
  }
})

exports.schedulePendingCleanUpFunction = functions.pubsub.schedule('1-59/15 * * * *').onRun(async(context) => {
  let updates = {}
  let now = new Date();
  now.setMinutes(findingNearestQuarterTime(now))
  let dateTimeString = makeDateTimeString(now);
  await admin.database().ref(`PendingMatchIDs/${dateTimeString}`)
  .once("value").then(snapshot => {
    let requests = snapshot.val();
    for(let [key, value] of Object.entries(requests)) {
      let ids = Object.keys(value)
      for(let id of ids) {
        updates[`/UserRequests/${id}/${key}`] = null;
        updates[`/Users/${id}/pendingMatchIDs/${key}`] = null;
      }
    }
  }).catch(err => console.log("15 minute awaitingmatchIDs clean up error " + err.message))
  try {
    updates[`PendingMatchIDs/${dateTimeString}`] = null;
    console.log(updates)
    await admin.database().ref().update(updates);
    console.log("15 minute pending requests deletion complete")
  } catch(err) {
    console.log("15 minute pending requests deletion error " + err.message)
  }
})


// exports.scheduleFunction = functions.pubsub.schedule('* * * * *').onRun((context) => {
//   let updates = {};
//   updates['/time'] = Math.random();
//   admin.database().ref().update(updates);
//   console.log('This will be run every minute!');
//   return null;
// });