const firebase = require("firebase");
const {admin} = require("../utils/admin");
const functions = require('firebase-functions')
const { config } = require("../utils/config");
const fetcher = require('node-fetch')
const {
  getCoords,
  getDatetime,
  getDistance,
  getThreshold,
  makeDateString,
  convertTimeToMinutes,
  gobbleRequestsRef,
  getUserDetails,
  measureCompatibility,
  isWithinRange,
  isWithinTime,
  DIETARY_ARRAYS,
  linkChats,
} = require('./MatchingHelpers')

const {
  CONFIRM_SUCCESS, CONFIRM_FAIL, FINAL_SUCCESS, 
  FINAL_FAIL, UNACCEPT_SUCCESS, UNACCEPT_FAIL, BLOCK_SUCCESS, 
  BLOCK_FAILURE, UNBLOCK_SUCCESS, UNBLOCK_FAILURE, DECLINE_SUCCESS, DECLINE_FAIL
} = require('./Results')

const isUserBlocked = async(uid, otherUid) => {
  let x = false;
  x = await admin.database().ref(`Users/${uid}/blockedUsers/${otherUid}`)
  .once("value")
  .then(snapshot => {
    return snapshot.val() ? true : false}
    )
  .catch(err => console.log(err)
  )
  return x;
}

exports.findGobbleMate = async(data, context) => {
    let request = data.request;
    let date1 = getDatetime(request)
    let ref = gobbleRequestsRef()
    .child(makeDateString(date1))
    //TODO: Stop users from entering matches with same datetime
    let tempRef;
    let coords1 = getCoords(request)
    let distance1 = getDistance(request)
    let time1 = convertTimeToMinutes(date1)
    let bestMatch = null;
    let bestMatchCompatibility = 5;
    let dietaryRef;
    let counter = 0;
    let dietaryOptionsArray = DIETARY_ARRAYS[`${request.dietaryRestriction}`]
    let requestRef2;
    let result = false;
    let response;
    // IF THE USER IS ANY, WE NEED TO SEARCH ALL THE PENDING REQUESTS
    for(;counter < dietaryOptionsArray.length; counter++) {
      const dietaryOption = dietaryOptionsArray[counter];
      console.log('looking through ' + dietaryOption);
      tempRef = ref.child(`${dietaryOption}`);
      await tempRef.once("value").then(async(snapshot) => {//values in same day under dietaryOption
        let iterator, child;
        let time2, coords2, distance2, date2;
        let children = snapshot.val()
        let compatibility
        for(iterator in children) {//iterate through these values
          child = children[iterator]
          coords2 = getCoords(child)
          distance2 = getDistance(child)
          date2 = getDatetime(child)
          time2 = convertTimeToMinutes(date2)
          //It's strange but isBlocked is not recognized if imported
          // from helpers
          // This is a hackish way of having it be recognised.
          let isBlocked1 = await isUserBlocked(request.userId, child.userId)
          let isBlocked2 = await isUserBlocked(child.userId, request.userId)
          let isBlocked = isBlocked1 || isBlocked2
          if(!isWithinRange(coords1, distance1, coords2, distance2) || 
          !isWithinTime(time1, time2) || isBlocked ||
          request.userId === child.userId) {
            console.log(child.userId)
            console.log(isWithinRange(coords1, distance1, coords2, distance2))
            console.log(coords1, distance1, coords2, distance2)
            console.log('out of range/time/same user/blocked');
            continue;
          }
          compatibility = await measureCompatibility(request, child) + measureCompatibility(child, request)
          console.log(compatibility, 'compatiblity');
          if (compatibility >= getThreshold()) {//for now threshold is 18 arbitrarily
            console.log('greater than threshold');
            response = await match(request, null, child, iterator);
            result = true;
            console.log("EARLY TERMINATION")
            break;
          } else if (compatibility > bestMatchCompatibility) {
            console.log('new best compatibility');
            bestMatchCompatibility = compatibility
            bestMatch = child;
            dietaryRef = iterator; 
          }
        }
      })
      if(result) {
        return {
          found: true,
          success: true, 
        };
      }
    }
    if (counter === dietaryOptionsArray.length) {
        if (bestMatch != null) {
          console.log("AT THE END OF LOOP");
          await match(request, null, bestMatch, dietaryRef);
          return {
            found: true,
            success: true, 
          };
        } else {
          await makeGobbleRequest(ref, request, date1)
          // Match not found, user may receive push notification later (or else scheduling push notifications)
          return {
            found: false,
            success: true,
          }
        }
    }
}

async function sendPushNotification(pushToken, message, body) {
  try {
    if (pushToken == null) {
      return ({
        success: false,
        message: `ADMIN PUSHTOKEN ERROR: pushToken does not exist`
      });
    } else {
      let response = await fetcher('https://exp.host/--/api/v2/push/send', {
              body: JSON.stringify({
                to: pushToken,
                title: message,
                body: body,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
              method: 'POST',
          });
          return {
              success: true,
              message: response
          };
    }
  } catch (err) {
    console.log(err.message);
    return ({
      success: false,
      message: `ADMIN PUSH NOTIF ERROR: ${err.message}`
    });
  }
}

/**
   * Handling database operations when two users match
   * @param {*} request1 request sent by first user
   * @param {*} dietaryRef1 Useful for scheduled functions - TODO for phase 3
   * @param {*} request2 request sent by second user
   * @param {*} request2Ref pending match ID of request2 in GobbleRequests and within the user object itself
   */
 async function match(request1, request1Ref, request2, request2Ref) {
    let request2UserDetails = await getUserDetails(request2.userId)
    let request1UserDetails = await getUserDetails(request1.userId)
    const pendingMatchID = await gobbleRequestsRef().child('ANY').child('ANY').push().key;
    let updates = {};

    //The Match Updates
    updates[`/Users/${request1.userId}/pendingMatchIDs/${pendingMatchID}`] = {...request1, otherUserId: request2.userId, 
      otherUserCuisinePreference: request2.cuisinePreference, otherUserDietaryRestriction: request2UserDetails.diet, 
      otherUserDOB: request2UserDetails.dob, otherUserLocation: request2.location, otherUserIndustry: request2UserDetails.industry,
      otherUserAvatar: request2UserDetails.avatar, otherUserDistance: request2.distance, otherUserName: request2UserDetails.name, matchID: pendingMatchID, lastMessage:'',}
    updates[`/Users/${request2.userId}/pendingMatchIDs/${pendingMatchID}`] = {...request2, otherUserId: request1.userId,
      otherUserCuisinePreference: request1.cuisinePreference, otherUserDietaryRestriction: request1UserDetails.diet, 
      otherUserDOB: request1UserDetails.dob, otherUserLocation: request1.location, otherUserIndustry: request1UserDetails.industry, 
      otherUserAvatar: request1UserDetails.avatar, otherUserDistance: request1.distance, otherUserName: request1UserDetails.name, matchID: pendingMatchID, lastMessage:'',}

    //Remove Respective Pending Matches
    // updates[`/Users/${request2.userId}/awaitingMatchIDs/${request1Ref}`] = null;
    updates[`/Users/${request2.userId}/awaitingMatchIDs/${request2Ref}`] = null;
    updates[`/UserRequests/${request2.userId}/${request2Ref}`] = null;
    updates[`/UserRequests/${request1.userId}/${pendingMatchID}`] = request1.datetime;
    updates[`/UserRequests/${request2.userId}/${pendingMatchID}`] = request2.datetime;
    // updates[`/GobbleRequests/${this.makeDateString(this.getDatetime(request1))}/${request1.dietaryRestriction}/${request1Ref}`] = null;
    updates[`/GobbleRequests/${makeDateString(getDatetime(request2))}/${request2.dietaryRestriction}/${request2Ref}`] = null;

    updates[`/PendingMatchIDs/${pendingMatchID}/${request1.userId}`] = false
    updates[`/PendingMatchIDs/${pendingMatchID}/${request2.userId}`] = false;

    try{
      // console.log('Updates',updates);
      await admin.database().ref().update(updates);
    } catch(err) {
      console.log('Match Update Error:', err.message);
      return false;
    }
      //After performing all updates, send push notif to other user about match
    let pushToken = await getPushToken(request2.userId);
    sendPushNotification(pushToken, 'We found you a Match!', 'You can view it in the Matches tab');
    return true;
}

/**
 * Function called when match is not instantly found
 * Pending match ID generated and added to the pile
 * @param {*} ref Reference of date object within GobbleRequests object
 * @param {*} request Request sent by user searching for gobble
 * @param {*} date Date object of request
 */
function makeGobbleRequest(ref, request, date) {
    const matchID = ref.child(`${request.dietaryRestriction}`).push().key;
    let updates = {};
    updates[`/Users/${request.userId}/awaitingMatchIDs/${matchID}`] = {...request, matchID: matchID};
    updates[`/GobbleRequests/${makeDateString(date)}/${request.dietaryRestriction}/${matchID}`] = {...request, matchID: matchID};
    updates[`/UserRequests/${request.userId}/${matchID}`] = request.datetime;
    // Add more updates here
    admin.database().ref().update(updates);
}

async function getPushToken(uid) {
  return admin.database().ref(`PushTokens/${uid}`).once("value")
          .then(snapshot => {
              return snapshot.val();
          })
          .catch(err => {
            console.log(err.message);
            return {};
          });
}


exports.matchDecline = async(data, context) => {
  let request = data.request;
  let uid = admin
  .auth()
  .verifyIdToken(data.idToken)
  .then(decodedToken => {
      return decodedToken.uid;
  })
      // add a check?
      let updates = {}
      updates[`/Users/${request.userId}/pendingMatchIDs/${request.matchID}`] = null
      updates[`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`] = null
      updates[`/UserRequests/${request.userId}/${request.matchID}`] = null;
      updates[`/UserRequests/${request.otherUserId}/${request.matchID}`] = null;
      updates[`/PendingMatchIDs/${request.matchID}`] = null;
      try {
        await admin.database().ref().update(updates);
        let pushToken = await getPushToken(request.otherUserId);
        sendPushNotification(pushToken, "Oh No! Your match has been declined", "Please schedule another match!");
        return {
          success: true,
          message: DECLINE_SUCCESS
        }
      } catch(err) {
        console.log('Match Decline Error ' + err.message)
        return {
          success: false,
          message: DECLINE_FAIL
        }
      }
}


exports.matchConfirm = async (data, context) => {
  let request = data.request;
  let result = await admin.database().ref(`/PendingMatchIDs/${request.matchID}/${request.otherUserId}`)
  .once("value")
  .then(snapshot => snapshot.val())
  .catch(err => {
    console.log(err.message);
    return {
      success: false,
      message: CONFIRM_FAIL};
  });
  if(result) {
    return matchFinalise(request);
  } else {
    let updates = {}
    updates[`/PendingMatchIDs/${request.matchID}/${request.userId}`] = true;
    try{
      // console.log('Updates',updates);
      await admin.database().ref().update(updates);
      return {
          success: true,
          message: CONFIRM_SUCCESS
      }
    } catch(err) {
      console.log('Match Confirm Error:', err.message);
      return {
          success: false,
          message: CONFIRM_FAIL
      }
    }
  }
}

async function matchFinalise(request) {
  let updates = {};
  let otherUserRequest = await admin.database().ref(`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`)
  .once("value")
  .then(snapshot => snapshot.val())
  .catch(err => {
    console.log(err.message);
    return {
      success: false,
      message: FINAL_FAIL
    }
  });

  updates[`/Users/${request.userId}/matchIDs/${request.matchID}`] = request
  updates[`/Users/${request.otherUserId}/matchIDs/${request.matchID}`] = otherUserRequest

  updates[`/PendingMatchIDs/${request.matchID}`] = null
  updates[`/Users/${request.userId}/pendingMatchIDs/${request.matchID}`] = null
  updates[`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`] = null

  updates = await linkChats(updates, request, otherUserRequest);
  try{
    // console.log('Updates',updates);
    await admin.database().ref().update(updates);
    //Sending Push Notifications to other user
    let pushToken = await getPushToken(request.otherUserId);
    sendPushNotification(pushToken, 'Match Confirmed!', 'You can now text your new Match!');
    return {
      success: true,
      message: FINAL_SUCCESS
    }
  } catch(err) {
    console.log('Match Confirm Error:', err.message);
    return ({
      success: false,
      message: FINAL_FAIL
    });
  }
}

exports.matchUnaccept = async(data, context) => {
  let request = data.request;
  let updates = {}
  updates[`/PendingMatchIDs/${request.matchID}/${request.userId}`] = false;
  try{
    await admin.database().ref().update(updates);
    return {
      success: true,
      message: UNACCEPT_SUCCESS
    }
  } catch(err) {
    console.log('Match Confirm Error:', err.message);
    return {
      success: false,
      message: UNACCEPT_FAIL
    }
  }
}