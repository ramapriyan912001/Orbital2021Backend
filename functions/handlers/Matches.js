
const {
  getCoords,
  getDatetime,
  getDistance,
  getThreshold,
  makeDateString,
  isBlocked,
  convertTimeToMinutes,
  gobbleRequestsRef,
  getUserDetails,
  getUserCollection,
  measureCompatibility,
  isWithinRange,
  isWithinTime,
  obtainStatusOfPendingMatch,
  userRef,
  calculateDistance,
  DIETARY_ARRAYS
} = require('./MatchingHelpers')

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
          let isBlocked1 = await isBlocked(request.userId, child.userId)
          let isBlocked2 = await isBlocked(child.userId, request.userId)
          let isBlocked = isBlocked1 || isBlocked2
          if(!isWithinRange(coords1, distance1, coords2, distance2) || 
          !isWithinTime(time1, time2) || isBlocked ||
          request.userId === child.userId) {
            console.log('out of range/time/same user/blocked');
            continue;
          }
          compatibility = await measureCompatibility(request, child) + measureCompatibility(child, request)
          console.log(compatibility, 'compatiblity');
          if (compatibility >= getThreshold()) {//for now threshold is 18 arbitrarily
            console.log('greater than threshold');
            await match(request, null, child, iterator)
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
        return true;
      }
    }
    if (counter === dietaryOptionsArray.length) {
        if (bestMatch != null) {
          console.log("AT THE END OF LOOP")
          match(request, null, bestMatch, dietaryRef)
          return true;
        } else {
        //   console.log('No match found! Creating new entry');
        //   this.makeGobbleRequest(ref, request, date1)
          return false;
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
 async function match(request1, request1Ref, request2, request2Ref) {
    let request2UserDetails = await getUserDetails(request2.userId)
    let request1UserDetails = await getUserDetails(request1.userId)
    const pendingMatchID = await gobbleRequestsRef().child('ANY').child('ANY').push().key;
    let updates = {}

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
    console.log(request2Ref)
    updates[`/UserRequests/${request2.userId}/${request2Ref}`] = null;
    updates[`/UserRequests/${request1.userId}/${pendingMatchID}`] = request1.datetime;
    updates[`/UserRequests/${request2.userId}/${pendingMatchID}`] = request2.datetime;
    // updates[`/GobbleRequests/${this.makeDateString(this.getDatetime(request1))}/${request1.dietaryRestriction}/${request1Ref}`] = null;
    updates[`/GobbleRequests/${makeDateString(getDatetime(request2))}/${request2.dietaryRestriction}/${request2Ref}`] = null;

    updates[`/PendingMatchIDs/${pendingMatchID}/${request1.userId}`] = false
    updates[`/PendingMatchIDs/${pendingMatchID}/${request2.userId}`] = false

    try{
      // console.log('Updates',updates);
      await admin.database().ref().update(updates);
    } catch(err) {
      console.log('Match Update Error:', err.message);
    }
      // TODO: What if the user changes his/her profile picture?
      // Maybe we need to create another table of just user + profile pic so we don't need to load a lot of data every time
}

exports.matchConfirm = async (data, context) => {
  let request = data.request;
  let result = await firebase.database().ref(`/PendingMatchIDs/${request.matchID}/${request.otherUserId}`)
  .once("value")
  .then(snapshot => snapshot.val())
  if(result) {
    return matchFinalise(request)
  } else {
    let updates = {}
    updates[`/PendingMatchIDs/${request.matchID}/${request.userId}`] = true;
    try{
      // console.log('Updates',updates);
      await admin.database().ref().update(updates);
      return {
          success: true,
          message: 'CONFIRM_SUCCESS'
      }
    } catch(err) {
      console.log('Match Confirm Error:', err.message);
      return {
          success: false,
          message: 'CONFIRM_FAILURE'
      }
    }
  }
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
      updates[`/PendingMatchIDs/${request.matchID}`] = null
      await admin.database().ref().update(updates)
      let pushToken = await admin.database().ref(`PushTokens/${request.otherUserId}`).once("value")
          .then(snapshot => {
              return snapshot.val();
          })
      let response = await fetcher('https://exp.host/--/api/v2/push/send', {
                  body: JSON.stringify({
                    to: pushToken,
                    title: "Oh No! Your match has been declined!",
                    body: "Please schedule another match!",
                  }),
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  method: 'POST',
              });
              return {
                  success: true,
                  message: response
              }
}

exports.matchFinalise = async(data, context) => {
  let request = data.request;
  let updates = {};
  let request2UserDetails = await this.getUserDetails(request.otherUserId)
  let request1UserDetails = await this.getUserDetails(request.userId)
  let otherUserRequest = await firebase.database().ref(`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`)
  .once("value")
  .then(snapshot => snapshot.val())

  updates[`/Users/${request.userId}/matchIDs/${request.matchID}`] = request
  updates[`/Users/${request.otherUserId}/matchIDs/${request.matchID}`] = otherUserRequest

  updates[`/PendingMatchIDs/${request.matchID}`] = null
  updates[`/Users/${request.userId}/pendingMatchIDs/${request.matchID}`] = null
  updates[`/Users/${request.otherUserId}/pendingMatchIDs/${request.matchID}`] = null

  updates = await this.linkChats(updates, request, otherUserRequest);
  try{
    // console.log('Updates',updates);
    await firebase.database().ref().update(updates);
    return FINAL_SUCCESS;
  } catch(err) {
    console.log('Match Confirm Error:', err.message);
    return FINAL_FAIL;
  }
}