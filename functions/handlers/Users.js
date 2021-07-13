const firebase = require("firebase");
const {admin} = require("../utils/admin");
const functions = require('firebase-functions')
// require("dotenv/config");
// const { adminConfig } = require(process.env.SERVICE_PATH);

const { config } = require("../utils/config");
firebase.initializeApp(config);

const userExists = (uid) => admin.auth().getUser(uid).then(user => true).catch(err => false);
const isAdmin = () => {
    return firebase
    .database()
    .ref(`ReportCount/${this.uid}`)
    .once("value")
    .then(snapshot => snapshot.exists())
  };

//BASIC AUTH FUNCTIONS
exports.createAuthUser = (req, res) => {
    return admin
    .auth()
    .createUser({
        email: req.body.body.email,
        emailVerified: !(req.body.body.verified == null),
        phoneNumber: req.body.body.phone == null ? '' : req.body.body.phone,
        password: req.body.body.password,
        displayName: req.body.body.name,
        photoURL: req.body.body.avatar == null ? 'empty_avatar' : req.body.body.avatar,
        disabled: !(req.body.body.disabled == null),
    })
    .then((userRecord) => {
        console.log('ADMIN: Successfully created new user:', userRecord.uid);
        return res.status(201).json({
            success: true,
            userRecord
        });
    })
    .catch((error) => {
        console.log('ADMIN: Error creating new user:', error.message);
        return res.status(500).json({
            success: false,
            message: `ADMIN CREATE USER ERROR: ${error.message}`
        });
});
};

exports.updateFullAuthUser = (req, res) => {
    return admin
    .auth()
    .updateUser(req.params.uid, {
        email: req.body.body.email,
        phoneNumber: req.body.body.phone,
        emailVerified: req.body.body.verified,
        password: req.body.body.password,
        displayName: req.body.body.name,
        photoURL: req.body.body.avatar,
        disabled: req.body.body.disabled
    })
    .then((userRecord) => {
        // See the UserRecord reference doc for the contents of userRecord.
        const userInfo = userRecord.toJSON();
        console.log('ADMIN: Successfully updated user', userInfo);
        return res.status(200).json({
            success: true,
            userInfo
        });
    })
    .catch((error) => {
        console.log('ADMIN: Error updating user:', error.message);
        return res.status(500).json({
            success: false,
            message: `ADMIN UPDATE USER ERROR: ${error.message}s`
        });
    });
};

const deleteUserCollection = (uid) => {
    if(userExists(uid)) {
        let updates = {};
        updates[`/Avatars/${uid}`] = null;
        updates[`/Industry/${uid}`] = null;
        updates[`/Users/${uid}`] = null;
        updates[`/ComplaintHistory/${uid}`] = null;
        updates[`/ComplaintCount/${uid}`] = null;
        updates[`/Chats/${uid}`] = null;
        if(isAdmin()) {
            updates[`/ReportCount/${uid}`] = null
        }
          // Need to delete any awaiting requests he has or
          // set a this.userExists() condition in the matching
          // function
        admin.database().ref().update(updates);
        return true;
    } else {
        return false;
    }
};

async function isBlocked(uid, otherUid) {
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

/**
   * Calculate distance between two users using coordinates provided
   * @param {*} coords1 coordinates of first user's location
   * @param {*} coords2 coordinates of second user's location
   * @returns the distance between the two users via a number value
   */
 function calculateDistance(coords1, coords2) {
    let lat1 = coords1['latitude']
    let lat2 = coords2['latitude']
    let lon1 = coords1['longitude']
    let lon2 = coords2['longitude']
    var p = 0.017453292519943295;    // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;
  
    const distance = 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
    return distance;
}

function isWithinRange(coords1, distance1, coords2, distance2) {
    return (distance1 + distance2) >= calculateDistance(coords1, coords2)
}

/**
   * Evaluates if two users are compatible based on their match times
   * @param {*} time1 Preferred time of first user request
   * @param {*} time2 Preferred time of second user request
   * @returns Boolean
   */
function isWithinTime(time1, time2) {
    return (Math.abs(time1-time2) <= 30)   
}

/**
   * Threshold for when matching algorithm can stop and return
   * This is supposed to be dynamic
   * Will be improved in phase 3
   * @param {*} request request sent by user
   * @returns a score number value
   */
function getThreshold(request) {
    // Will have a threshold function to mark how low a score we are willing to accept for a match
    // Nearer to the schedule time, the lower the threshold
    // This is for milestone 3
    // For now we just have a threshold of 18 points
    return 18;
}

async function findGobbleMate(request) {
    console.log('Finding a match');
    console.log(request)
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

/**
   * Getter for user details
   * @param {*} id user id
   * @returns user object
   */
async function getUserDetails(id) {
    return getUserCollection(id, snapshot => snapshot.val(), err => console.log(err))
}

const getUserCollection = (id, success, failure) => id != null
                                                ? userRef(id)
                                                  .once('value')
                                                  .then(success)
                                                  .catch(failure)
                                                : failure({code: 'auth/invalid-id', message: 'Invalid UID provided'});

/**
   * Get the reference to object within the GobbleRequests object within the database
   * @param {*} params id of object
   * @returns reference
   */
function gobbleRequestsRef() {
    return admin.database().ref(`GobbleRequests`)
}

/**
   * Get the reference to user object within the users object within the database
   * @param {*} params id of object
   * @returns reference
   */
function userRef(params) {
    return admin.database().ref(`Users/${params}`);
}

  /**
   * Converts the date object into a readable string
   * So that it can be stored in the database easily
   * @param {*} date Date object
   * @returns String of date
   */
function makeDateString(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

  /**
   * Get coordinates of the user's location
   * @param {*} request match request sent by user searching for gobble
   * @returns 
   */
function getCoords(request) {
    return request['location']['coords']
}

  /**
   * Get datetime string from request sent by user
   * @param {*} request match request sent by user searching for gobble
   * @returns 
   */
function getDatetime(request) {
    console.log(request)
    return new Date(request['datetime'])
}

  /**
   * Get preferred distance for meal from request sent by user
   * @param {*} request match request sent by user searching for gobble
   * @returns 
   */
function getDistance(request) {
    return request['distance']
}

  /**
   * Convert time into minutes to easily evaluate time difference
   * @param {*} date date object
   * @returns 
   */
function convertTimeToMinutes(date) {
    return date.getHours()*60 + date.getMinutes()
}

function measureCompatibility(request1, request2) {
    let compatibility = 0;
    if(request1.cuisinePreference == request2.cuisinePreference) {
      compatibility += 5;
    }
    if(request1.industryPreference == 12 || (request1.industryPreference == request2.industry)) {
      compatibility += 5;
    }
    return compatibility;
}

exports.addPushTokenToDatabase = (data, context) => {
    admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        const uid = decodedToken.uid
        let updates = {};
        updates[`/PushTokens/${uid}`] = data.pushToken;
        admin
        .database()
        .ref()
        .update(updates)
    })
}

exports.deleteUserByUID = (data, context) => {
    // Verify the ID token while checking if the token is revoked by passing
    // checkRevoked true.
    let checkRevoked = true;
    const idToken = data.token;
    console.log('Token: ', idToken);
    return admin
    .auth()
    .verifyIdToken(idToken, checkRevoked)
    .then((payload) => {
        console.log('Payload: ', payload);
        // Token is valid.
        if (payload.admin === false) {
            return ({
                success: false,
                message: `Calling User does not have Admin Permissions`
            });
        } else {
            return admin
            .auth()
            .deleteUser(data.uid)
            .then(() => {
            if (deleteUserCollection(data.uid)) {
                console.log('ADMIN: Successfully deleted user');
                return ({
                    success: true,
                    message: `User ${data.uid} has been deleted!`
                });
            } else {
                console.log('ADMIN: Error deleting User Collection');
                return ({
                    success: false,
                    message: `ADMIN DELETE USER ERROR: Auth deleted but User Collection not deleted fully`
                });
            }
            })
            .catch((error) => {
            if ('auth/user-not-found' === error.message) {
                if (deleteUserCollection(data.uid)) {
                    console.log('ADMIN: Successfully deleted user from collection ONLY');
                    return ({
                        success: true,
                        message: `User ${data.uid} has been deleted!`
                    });
                } else {
                    console.log('ADMIN: Error deleting User Collection');
                    return ({
                        success: false,
                        message: `ADMIN DELETE USER ERROR: Auth deleted but User Collection not deleted fully`
                    });
                }
            } else {
                console.log('ADMIN: Error deleting user:', error.message);
                return ({
                    success: false,
                    message: `ADMIN DELETE USER ERROR: ${error.message}`
                });
            }
            });
        }
    })
    .catch((error) => {
        if (error.code == 'auth/id-token-revoked') {
        // Token has been revoked. Inform the user to reauthenticate or signOut() the user.
            console.log('ADMIN DELETE USER MESSAGE: TOKEN REVOKED');
            return ({
                success: false,
                message: `Token Revoked, Sign Out or Re-Authenticate`
            })
        } else {
            console.log(`ADMIN DELETE USER ERROR: ${error.message}`);
            return ({
                success: false,
                message: error.message
            })
        // Token is invalid.
        }
    });
};

exports.deleteUsersByUID = (data, context) => {
    // Verify the ID token while checking if the token is revoked by passing
    // checkRevoked true.
    let checkRevoked = true;
    const idToken = data.token;
    console.log('Context: ', context);
    return admin
    .auth()
    .verifyIdToken(idToken, checkRevoked)
    .then((claims) => {
        console.log('Claims: ', claims);
        // Token is valid.
        if (claims == null||(!claims.admin)) {
            return ({
                success: false,
                message: `Calling User does not have Admin Permissions`
            });
        } else {
            admin
            .auth()
            .deleteUsers(data.uids)
            .then((deleteUsersResult) => {
            let totalCount = 0;
            data.uids
            .map((uid) => deleteUserCollection(uid))
            .filter(isUidDeleted => {
                totalCount++;
                return isUidDeleted;
            });
            if (deleteUsersResult.failureCount < 1 && totalCount < 1) {
                console.log(`ADMIN: Successfully deleted ${deleteUsersResult.successCount} users`);        
                return ({
                    success:true,
                    message: 'Users deleted'
                });
            } else if (totalCount > 0) {
                console.log(`ADMIN: Failed to delete ${deleteUsersResult.failureCount} users from user collection`);
                return ({
                    success: false,
                    message: 'Unable to delete all user collections'
                });
            } else {
                deleteUsersResult.errors.forEach((err) => {
                console.log('ADMIN: ', err.error.toJSON());
                });
                return ({
                    success: false,
                    message: 'Unable to delete all users'
                });
            }
            })
            .catch((error) => {
            console.log('Error deleting users:', error);
            return ({
                success: false,
                message: `ADMIN DELETE USERS ERROR: ${error.message}`
            });
            });
        }
    })
    .catch((error) => {
        if (error.code == 'auth/id-token-revoked') {
        // Token has been revoked. Inform the user to reauthenticate or signOut() the user.
            console.log('ADMIN DELETE USER MESSAGE: TOKEN REVOKED');
            return ({
                success: false,
                message: `Token Revoked, Sign Out or Re-Authenticate`
            })
        } else {
            console.log(`ADMIN DELETE USERS ERROR: ${error.message}`);
            return ({
                success: false,
                message: error.message
            })
        // Token is invalid.
        }
    });
};

exports.promoteToAdmin = (data, context) => {
    const uid = data.uid;
    return admin
    .auth()
    .getUser(uid)
    .then((userRecord) => {
        if (userRecord.customClaims && userRecord.customClaims['admin']) {
            console.log('User is already admin, do nothing');
            return ({
                success: false,
                message: 'User is already an admin'
            });
        } else {
            return admin
            .auth()
            .setCustomUserClaims(uid, {admin: true})
            .then(async () => {
                // The new custom claims will propagate to the user's ID token the
                // next time a new one is issued.
                
                // Lookup the user associated with the specified uid.
                await admin
                .auth()
                .getUser(uid)
                .then((userRecord) => {
                // The claims can be accessed on the user record.
                console.log('Custom Claims: ', userRecord.customClaims);
                });

                return ({
                    success: true,
                    message: `Congratulations! ${userRecord.displayName} is now an admin`
                })
            })
            .catch(err => {
                return ({
                    success: false,
                    message: `SET ADMIN ERROR: ${err.message}`
                })
            })
        }
    })
    .catch((err) => ({
        success: false,
        message: `PROMOTE ADMIN - GET USER ERROR: ${err.message}`
    }));
};

// module.exports({ deleteUserByUID, deleteUsersByUID, createAuthUser, updateFullAuthUser });