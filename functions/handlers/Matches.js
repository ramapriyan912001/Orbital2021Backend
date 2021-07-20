const firebase = require("firebase");
const {admin} = require("../utils/admin");
const functions = require('firebase-functions')
const { config } = require("../utils/config");
const fetcher = require('node-fetch')
const {
  getCoords,
  getDatetime,
  getDistance,
  makeDateString,
  makeDateTimeString,
  gobbleRequestsRef,
  getUserDetails,
  measureCompatibility,
  isWithinRange,
  isWithinTime,
  DIETARY_ARRAYS,
  linkChats,
  getPendingTime,
  getDatetimeFromObject,
  sendPushNotification,
  getPushToken,
  SATISFACTION_THRESHOLD,
  STOP_SEARCH_THRESHOLD,
  isGobbleTimeClose,
  MINIMUM_COMPATIBILITY,
} = require('./MatchingHelpers')

const {
  CONFIRM_SUCCESS, CONFIRM_FAIL, FINAL_SUCCESS, 
  FINAL_FAIL, UNACCEPT_SUCCESS, UNACCEPT_FAIL, DECLINE_SUCCESS, 
  DECLINE_FAIL, DELETE_REQUEST_SUCCESS, DELETE_REQUEST_FAILURE
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

exports.scheduledFindGobbleMate = async(request) => {
    if(!isGobbleTimeClose(request.datetime)) {
      return {
        found: false,
        success: true
      }
    }
    let date1 = getDatetime(request)
    let ref = gobbleRequestsRef()
    .child(makeDateString(date1))
    //TODO: Stop users from entering matches with same datetime
    let tempRef;
    let coords1 = getCoords(request)
    let distance1 = getDistance(request)
    let bestMatch = null;
    let bestMatchCompatibility = -1;
    let dietaryRef;
    let counter = 0;
    let dietaryOptionsArray = DIETARY_ARRAYS[`${request.dietaryRestriction}`]
    // IF THE USER IS ANY, WE NEED TO SEARCH ALL THE PENDING REQUESTS
    for(;counter < dietaryOptionsArray.length; counter++) {
      const dietaryOption = dietaryOptionsArray[counter];
      console.log('looking through ' + dietaryOption);
      tempRef = ref.child(`${dietaryOption}`);
      await tempRef.once("value").then(async(snapshot) => {//values in same day under dietaryOption
        let iterator, child;
        let coords2, distance2, date2;
        let children = snapshot.val()
        let compatibility
        for(iterator in children) {//iterate through these values
          child = children[iterator]
          coords2 = getCoords(child)
          distance2 = getDistance(child)
          date2 = getDatetime(child)
  
          let isBlocked1 = await isUserBlocked(request.userId, child.userId)
          let isBlocked2 = await isUserBlocked(child.userId, request.userId)
          let isBlocked = isBlocked1 || isBlocked2
          if(!isWithinRange(coords1, distance1, coords2, distance2) || 
          !isWithinTime(date1, date2) || isBlocked ||
          request.userId === child.userId) {
            console.log(child.userId)
            console.log(isWithinRange(coords1, distance1, coords2, distance2))
            console.log(coords1, distance1, coords2, distance2)
            console.log('out of range/time/same user/blocked');
            continue;
          }
          compatibility = await measureCompatibility(request, child) + measureCompatibility(child, request)
          console.log(compatibility, 'compatiblity');
          if (compatibility > bestMatchCompatibility) {
            console.log('new best compatibility');
            bestMatchCompatibility = compatibility
            bestMatch = child;
            dietaryRef = iterator; 
          }
        }
      })
    }
    if (counter === dietaryOptionsArray.length) {
        if (bestMatch != null) {
          console.log("AT THE END OF LOOP");
          await match(request, true, bestMatch, dietaryRef);
          return {
            found: true,
            success: true, 
            match: bestMatch.matchID
          };
        } else {
          // Match not found, user may receive push notification later (or else scheduling push notifications)
          return {
            found: false,
            success: true,
          }
        }
    }
}

exports.findGobbleMate = async(data, context) => {
  let request = data.request;
  let uid = await admin
  .auth()
  .verifyIdToken(data.idToken)
  .then(decodedToken => {
      return decodedToken.uid;
  })
  .catch(err => {
    console.error('FINDGOBBLEMATE ADMIN ERROR:', err.message);
    return null;
  })
  if(uid == null || uid != request.userId) {
    console.log("Unauthorized request findGobbleMate")
    return {
      found: false,
      success: false,
    }
  }
  if(!isGobbleTimeClose(request.datetime)) {
    return findGobbleMateWithThresholds(request);
  }
  let date1 = getDatetime(request)
  let ref = gobbleRequestsRef()
  .child(makeDateString(date1))
  //TODO: Stop users from entering matches with same datetime
  let tempRef;
  let coords1 = getCoords(request)
  let distance1 = getDistance(request)
  let bestMatch = null;
  let bestMatchCompatibility = -1;
  let dietaryRef;
  let counter = 0;
  let dietaryOptionsArray = DIETARY_ARRAYS[`${request.dietaryRestriction}`]
  let result = false;
  let response;
  // IF THE USER IS ANY, WE NEED TO SEARCH ALL THE PENDING REQUESTS
  for(;counter < dietaryOptionsArray.length; counter++) {
    const dietaryOption = dietaryOptionsArray[counter];
    console.log('looking through ' + dietaryOption);
    tempRef = ref.child(`${dietaryOption}`);
    await tempRef.once("value").then(async(snapshot) => {//values in same day under dietaryOption
      let iterator, child;
      let coords2, distance2, date2;
      let children = snapshot.val()
      let compatibility
      for(iterator in children) {//iterate through these values
        child = children[iterator]
        coords2 = getCoords(child)
        distance2 = getDistance(child)
        date2 = getDatetime(child)

        let isBlocked1 = await isUserBlocked(request.userId, child.userId)
        let isBlocked2 = await isUserBlocked(child.userId, request.userId)
        let isBlocked = isBlocked1 || isBlocked2
        if(!isWithinRange(coords1, distance1, coords2, distance2) || 
        !isWithinTime(date1, date2) || isBlocked ||
        request.userId === child.userId) {
          console.log(child.userId)
          console.log(isWithinRange(coords1, distance1, coords2, distance2))
          console.log(coords1, distance1, coords2, distance2)
          console.log('out of range/time/same user/blocked');
          continue;
        }
        compatibility = await (measureCompatibility(request, child) + measureCompatibility(child, request));
        console.log(compatibility, 'compatiblity');
        if (compatibility >= 2*STOP_SEARCH_THRESHOLD) {//for now threshold is 18 arbitrarily
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

/**
   * Handling database operations when two users match
   * @param {*} request1 request sent by first user
   * @param {*} dietaryRef1 Useful for scheduled functions - TODO for phase 3
   * @param {*} request2 request sent by second user
   * @param {*} request2Ref pending match ID of request2 in GobbleRequests and within the user object itself
   */
 async function match(request1, sendNotifsToBothUsers, request2, request2Ref) {
    let request2UserDetails = await getUserDetails(request2.userId)
    let request1UserDetails = await getUserDetails(request1.userId)
    const pendingMatchID = await admin.database().ref().push().key;
    let updates = {};
    let dateString = makeDateString(getDatetime(request2))
    let dateTimeString = await makeDateTimeString(getDatetime(request2))
    let pendingTime, pendingTimeString;
    if(getDatetime(request1) < getDatetime(request2)) {
      pendingTime = getDatetimeFromObject(request2)
      pendingTimeString = makeDateTimeString(getDatetime(request2))
    } else {
      pendingTime = getDatetimeFromObject(request1)
      pendingTimeString = makeDateTimeString(getDatetime(request1))
    }

    //The Match Updates
    updates[`/Users/${request1.userId}/pendingMatchIDs/${pendingMatchID}`] = {...request1, otherUserId: request2.userId, 
      otherUserCuisinePreference: request2.cuisinePreference, otherUserDietaryRestriction: request2UserDetails.diet, pendingTime: pendingTime,
      otherUserDOB: request2UserDetails.dob, otherUserLocation: request2.location, otherUserIndustry: request2UserDetails.industry, otherUserDatetime: request2.datetime,
      otherUserAvatar: request2UserDetails.avatar, otherUserDistance: request2.distance, otherUserName: request2UserDetails.name, matchID: pendingMatchID, lastMessage:'',}
    updates[`/Users/${request2.userId}/pendingMatchIDs/${pendingMatchID}`] = {...request2, otherUserId: request1.userId,
      otherUserCuisinePreference: request1.cuisinePreference, otherUserDietaryRestriction: request1UserDetails.diet, pendingTime: pendingTime,
      otherUserDOB: request1UserDetails.dob, otherUserLocation: request1.location, otherUserIndustry: request1UserDetails.industry, otherUserDatetime: request1.datetime,
      otherUserAvatar: request1UserDetails.avatar, otherUserDistance: request1.distance, otherUserName: request1UserDetails.name, matchID: pendingMatchID, lastMessage:'',}

    //Remove Respective Pending Matches
    // updates[`/Users/${request2.userId}/awaitingMatchIDs/${request1Ref}`] = null;
    updates[`/Users/${request2.userId}/awaitingMatchIDs/${request2.matchID}`] = null;
    updates[`/UserRequests/${request2.userId}/${request2.matchID}`] = null;
    updates[`/UserRequests/${request1.userId}/${pendingMatchID}`] = request1.datetime;
    updates[`/UserRequests/${request2.userId}/${pendingMatchID}`] = request2.datetime;
    updates[`/GobbleRequests/${dateString}/${request2.dietaryRestriction}/${request2Ref}`] = null;
    updates[`/AwaitingPile/${dateTimeString}/${request2.matchID}`] = null;
    updates[`/PendingMatchIDs/${pendingTimeString}/${pendingMatchID}/${request1.userId}`] = false
    updates[`/PendingMatchIDs/${pendingTimeString}/${pendingMatchID}/${request2.userId}`] = false;

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
    if(sendNotifsToBothUsers) {
      let pushToken2 = await getPushToken(request1.userId);
      sendPushNotification(pushToken2, 'We found you a Match!', 'You can view it in the Matches tab');
    }
    return true;
}

const findGobbleMateWithThresholds = async(request) => {
  let date1 = getDatetime(request)
  let ref = gobbleRequestsRef()
  .child(makeDateString(date1))
  //TODO: Stop users from entering matches with same datetime
  let tempRef;
  let coords1 = getCoords(request)
  let distance1 = getDistance(request)
  let bestMatch = null;
  let bestMatchCompatibility = 5;
  let dietaryRef;
  let counter = 0;
  let dietaryOptionsArray = DIETARY_ARRAYS[`${request.dietaryRestriction}`]
  let result = false;
  let response;
  // IF THE USER IS ANY, WE NEED TO SEARCH ALL THE PENDING REQUESTS
  for(;counter < dietaryOptionsArray.length; counter++) {
    const dietaryOption = dietaryOptionsArray[counter];
    console.log('looking through ' + dietaryOption);
    tempRef = ref.child(`${dietaryOption}`);
    await tempRef.once("value").then(async(snapshot) => {//values in same day under dietaryOption
      let iterator, child;
      let coords2, distance2, date2;
      let children = snapshot.val()
      let compatibility
      for(iterator in children) {//iterate through these values
        child = children[iterator]
        coords2 = getCoords(child)
        distance2 = getDistance(child)
        date2 = getDatetime(child)

        let isBlocked1 = await isUserBlocked(request.userId, child.userId)
        let isBlocked2 = await isUserBlocked(child.userId, request.userId)
        let isBlocked = isBlocked1 || isBlocked2
        if(!isWithinRange(coords1, distance1, coords2, distance2) || 
        !isWithinTime(date1, date2) || isBlocked ||
        request.userId === child.userId) {
          console.log(child.userId)
          console.log(isWithinRange(coords1, distance1, coords2, distance2))
          console.log(coords1, distance1, coords2, distance2)
          console.log('out of range/time/same user/blocked');
          continue;
        }
        let requestCompatibility = await measureCompatibility(request, child) 
        let childCompatibility = await measureCompatibility(child, request)
        let totalCompatibility = requestCompatibility + childCompatibility;
        if (requestCompatibility >= STOP_SEARCH_THRESHOLD && 
        childCompatibility >= STOP_SEARCH_THRESHOLD) {//for now threshold is 18 arbitrarily
          console.log('greater than threshold');
          response = await match(request, null, child, iterator);
          result = true;
          console.log("EARLY TERMINATION")
          break;
        } else if (totalCompatibility > bestMatchCompatibility && 
          requestCompatibility >= SATISFACTION_THRESHOLD && 
          childCompatibility >= SATISFACTION_THRESHOLD) {
          console.log('new best compatibility');
          bestMatchCompatibility = totalCompatibility
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
    let dateString = makeDateString(date)
    let dateTimeString = makeDateTimeString(date)
    updates[`/GobbleRequests/${dateString}/${request.dietaryRestriction}/${matchID}`] = {...request, matchID: matchID};
    updates[`/AwaitingPile/${dateTimeString}/${matchID}`] = {...request, matchID: matchID};
    updates[`/UserRequests/${request.userId}/${matchID}`] = request.datetime;
    // Add more updates here
    admin.database().ref().update(updates);
}

exports.matchDecline = async(data, context) => {
  let request = data.request;
  let uid = await admin
  .auth()
  .verifyIdToken(data.idToken)
  .then(decodedToken => {
      return decodedToken.uid;
  })
  if(uid == null || uid != request.userId) {
    console.log("Unauthorized request matchDecline")
    return {
      success: false,
      message: DECLINE_FAIL
    }
  }
      // add a check?
      let updates = {}
      updates[`/Users/${request.userId}/pendingMatchIDs/${request.matchID}`] = null
      updates[`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`] = null
      updates[`/UserRequests/${request.userId}/${request.matchID}`] = null;
      updates[`/UserRequests/${request.otherUserId}/${request.matchID}`] = null;
      updates[`/PendingMatchIDs/${makeDateTimeString(getPendingTime(request))}/${request.matchID}`] = null;
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
  let uid = await admin
  .auth()
  .verifyIdToken(data.idToken)
  .then(decodedToken => {
      return decodedToken.uid;
  })
  if(uid == null || uid != request.userId) {
    console.log("Unauthorized request matchConfirm")
    return {
      success: false,
      message: CONFIRM_FAIL
    }
  }
  let result = await admin.database().ref(`/PendingMatchIDs/${makeDateTimeString(getPendingTime(request))}/${request.matchID}/${request.otherUserId}`)
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
    updates[`/PendingMatchIDs/${makeDateTimeString(getPendingTime(request))}/${request.matchID}/${request.userId}`] = true;
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
  let requestPendingTimeString = makeDateTimeString(getPendingTime(request))

  updates[`/Users/${request.userId}/matchIDs/${request.matchID}`] = request
  updates[`/Users/${request.otherUserId}/matchIDs/${request.matchID}`] = otherUserRequest
  updates[`/MatchIDs/${requestPendingTimeString}/${request.matchID}`] = {
    userId: request.userId,
    otherUserId: request.otherUserId
  };
  updates[`/PendingMatchIDs/${requestPendingTimeString}/${request.matchID}`] = null
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
  let uid = await admin
  .auth()
  .verifyIdToken(data.idToken)
  .then(decodedToken => {
      return decodedToken.uid;
  })
  if(uid == null || uid != request.userId) {
    console.log("Unauthorized Request matchUnaccept")
    return {
      success: false,
      message: UNACCEPT_FAIL
    }
  }
  let updates = {}
  updates[`/PendingMatchIDs/${makeDateTimeString(getPendingTime(request))}/${request.matchID}/${request.userId}`] = false;
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

exports.deleteAwaitingRequest = async(data, context) => {
  let request = data.request
  let uid = await admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        return decodedToken.uid;
    })
    if(uid == null || uid != request.userId) {
      console.log("Unauthorized request deleteAwaitingRequest")
      return {
        success: false,
        message: DELETE_REQUEST_FAILURE,
      }
    }
  let updates = {};
  updates[`/Users/${request.userId}/awaitingMatchIDs/${request.matchID}`] = null;
  let dateString = makeDateString(getDatetime(request))
  let dateTimeString = await makeDateTimeString(new Date(getDatetime(request).toUTCString().slice(0, -4)))
  updates[`/GobbleRequests/${dateString}/${request.dietaryRestriction}/${request.matchID}`] = null;
  updates[`/AwaitingPile/${dateTimeString}/${request.matchID}`] = null;
  updates[`/UserRequests/${request.userId}/${request.matchID}`] = null
  // Add more updates here
  try {
    await admin.database().ref().update(updates);
    return {
      success: true,
      message: DELETE_REQUEST_SUCCESS
    }
  } catch(err) {
    console.log('Delete Awaiting Request Error: ' + err)
    return {
      success: false,
      message: DELETE_REQUEST_FAILURE
    }
  }
}