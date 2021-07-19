const functions = require("firebase-functions");
const {admin} = require("./utils/admin");
const express = require("express");
const App = express();
// const cors = require('cors');
// App.use(cors());

const {
  makeDateString,
  findingNearestQuarterTime,
  makeDateTimeString,
  getPushToken,
  sendPushNotifications,
  ALL_DIETS,
  getDatetimeArray
} = require('./handlers/MatchingHelpers')

const {
  deleteUserByUID,
  deleteUsersByUID,
  createAuthUser,
  updateFullAuthUser,
  promoteToAdmin,
  addPushTokenToDatabase,
  deleteAccount,
} = require('./handlers/Users');

const {
  blockUser,
  unblockUser,
  makeReport,
  deleteReport
} = require('./handlers/ReportBlock')

const {
  matchDecline,
  matchConfirm,
  findGobbleMate,
  matchUnaccept,
  deleteAwaitingRequest,
  scheduledFindGobbleMate,
} = require('./handlers/Matches')

const {
  sendMessageNotif
} = require('./handlers/Chats');

// API calls from frontend
exports.deleteUser = functions.https.onCall(deleteUserByUID);
exports.deleteUsers = functions.https.onCall(deleteUsersByUID);
exports.promoteUserToAdmin = functions.https.onCall(promoteToAdmin);
exports.addPushTokenToDatabase = functions.https.onCall(addPushTokenToDatabase)
exports.matchDecline = functions.https.onCall(matchDecline)
exports.matchConfirm = functions.https.onCall(matchConfirm)
exports.findGobbleMate = functions.https.onCall(findGobbleMate)
exports.matchUnaccept = functions.https.onCall(matchUnaccept)
exports.sendMessageNotif = functions.https.onCall(sendMessageNotif);
exports.deleteAccount = functions.https.onCall(deleteAccount)
exports.blockUser = functions.https.onCall(blockUser)
exports.unblockUser = functions.https.onCall(unblockUser)
exports.makeReport = functions.https.onCall(makeReport)
exports.deleteReport = functions.https.onCall(deleteReport)
exports.deleteAwaitingRequest = functions.https.onCall(deleteAwaitingRequest)



//Scheduled Functions
exports.scheduleAwaitingCleanUpFunction = functions.pubsub.schedule('1-59/15 * * * *').onRun(async(context) => {
  let updates = {}
  let now = new Date();
  now.setMinutes(findingNearestQuarterTime(now))
  let todayString = makeDateString(now);
  let todayTimeString = makeDateTimeString(now)
  let messages = []
  await admin.database().ref(`AwaitingPile/${makeDateTimeString(now)}`)
  .once("value").then(snapshot => {
    let requests = snapshot.val();
    for(let [key, value] of Object.entries(requests)) {
      updates[`/UserRequests/${value.userId}/${key}`] = null;
      updates[`/Users/${value.userId}/awaitingMatchIDs/${key}`] = null;
      updates[`/GobbleRequests/${todayString}/${value.dietaryRestriction}`] = null;
      const userPushToken = getPushToken(value.userId)
      if(userPushToken != null) {
        messages.push({
          to: userPushToken,
          title: 'Time elapsed on your Gobble request!',
          body: 'Make another request and find a Gobblemate!'
        })
      }
    }
  }).catch(err => console.log("15 minute awaitingmatchIDs clean up error " + err.message))
  if(messages != []) {
    sendPushNotifications(messages);
  }
  try {
    updates[`/AwaitingPile/${todayTimeString}`] = null
    await admin.database().ref().update(updates);
    console.log("15 minute awaiting requests deletion complete")
  } catch(err) {
    console.log("15 minute awaiting requests deletion error " + err.message)
  }
})

exports.schedulePendingCleanUpFunction = functions.pubsub.schedule('1-59/15 * * * *').onRun(async(context) => {
  let updates = {}
  let now = new Date();
  let messages = []
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
        let userPushToken = getPushToken(id)
        if(userPushToken != null) {
          messages.push({
            to: userPushToken,
            title: 'Time elapsed on your Pending Match!',
            body: 'Make another request and find a Gobblemate!'
          })
        }
      }
    }
  }).catch(err => console.log("15 minute awaitingmatchIDs clean up error " + err.message))
  if(messages != []) {
    sendPushNotifications(messages);
  }
  try {
    updates[`PendingMatchIDs/${dateTimeString}`] = null;
    console.log(updates)
    await admin.database().ref().update(updates);
    console.log("15 minute pending requests deletion complete")
  } catch(err) {
    console.log("15 minute pending requests deletion error " + err.message)
  }
})

exports.periodicMatchFindingFunction = functions.pubsub.schedule('0-59/15 * * * *').onRun(async(context) => {
  let now = new Date();
  let todayString = makeDateString(now);
  let matched = {};
  for(let diet of ALL_DIETS) {
    await admin.database().ref(`GobbleRequests/${todayString}/${diet}`).once("value",async(snapshot) => {
      let requests = snapshot.val()
      for(let [id, request] of Object.entries(requests)) {
        if(!matched[id]) {
          let response = await scheduledFindGobbleMate(request);
          if(response.found) {
            matched[response.match] = true;
          }
        }
      }
    })
  }
  if(now.getHours() == 23) {
    for(let time of getDatetimeArray()) {
      await admin.database().ref(`AwaitingPile/${time}`).once("value", async(snapshot) => {
        let requests = snapshot.val()
        for(let [id, request] of Object.entries(requests)) {
          if(!matched[id]) {
            let response = await scheduledFindGobbleMate(request);
            if(response.found) {
              matched[response.match] = true;
            }
          }
        }
      })
    }
  }
  console.log(matched)
})

exports.userRequestsTableCleanup = functions.pubsub.schedule('1-59/15 * * * *').onRun(async(context) => {
  let updates = {}
  let now = new Date();
  now.setMinutes(findingNearestQuarterTime(now))
  let dateTimeString = makeDateTimeString(now);
  await admin.database().ref(`MatchIDs/${dateTimeString}`)
  .once("value").then(snapshot => {
    let requests = snapshot.val();
    for(let [key, value] of Object.entries(requests)) {
      for(let id of Object.keys(value)) {
        updates[`/UserRequests/${id}/${key}`] = null;
        // updates[`/Users/${id}/matchIDs/${key}`] = null;
      }
    }
  }).catch(err => console.log("15 minute MatchIDs clean up error " + err.message))
  try {
    updates[`/MatchIDs/${dateTimeString}`] = null;
    console.log(updates)
    await admin.database().ref().update(updates);
    console.log("15 minute userRequests matchIDs deletion complete")
  } catch(err) {
    console.log("15 minute userRequests matchIDs deletion error " + err.message)
  }
})