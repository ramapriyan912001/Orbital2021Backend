const firebase = require("firebase");
const {admin} = require("../utils/admin");
const functions = require('firebase-functions')
const { config } = require("../utils/config");
const fetcher = require('node-fetch')
const {BLOCK_SUCCESS, BLOCK_FAILURE, UNBLOCK_SUCCESS, UNBLOCK_FAILURE, MAKE_REPORT_SUCCESS, MAKE_REPORT_FAILURE} = require('./Results');
const { makeDateTimeString, getPendingTime } = require("./MatchingHelpers");

function removeBlockedUserPendingMatches(uid, otherUid, pendingMatches) {
    let updates = {}
    for(let [key, value] of Object.entries(pendingMatches)) {
      let id = value['otherUserId']
      if(id == otherUid) {
        delete pendingMatches[key]
        console.log(key)
        updates[`/PendingMatchIDs/${makeDateTimeString(getPendingTime(value))}/${key}`] = null;
        updates[`/Users/${otherUid}/pendingMatchIDs/${key}`] = null
        updates[`/UserRequests/${uid}/${key}`] = null
        updates[`/UserRequests/${otherUid}/${key}`] = null
      }
    }
    updates[`/Users/${uid}/pendingMatchIDs`] = pendingMatches
    admin.database().ref().update(updates)
  }      
  
function removeBlockedUserMatches(uid, otherUid, matches) {
    let updates = {}
    for(let [key, value] of Object.entries(matches)) {
      let id = value['otherUserId']
      if(id == otherUid) {
        delete matches[key]
        updates[`/Users/${otherUid}/matchIDs/${key}`] = null
        updates[`/UserRequests/${uid}/${key}`] = null
        updates[`/UserRequests/${otherUid}/${key}`] = null
      }
    }
    updates[`/Users/${uid}/matchIDs`] = matches
    admin.database().ref().update(updates)
}

  exports.blockUser = async(data, context) => {
    let otherUserNameAndAvatar = data.otherUserNameAndAvatar
    let otherUid = data.otherUid
    let updates = {}
    let uid = await admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        return decodedToken.uid;
    })
    if(uid == null) {
      console.log("Unauthorized request blockUser")
      return {
        success: false,
        message: BLOCK_FAILURE,
      }
    }
    return admin.database().ref(`Users/${uid}/pendingMatchIDs`)
    .once("value")
    .then(snapshot => {
      if(snapshot.val()) {
        removeBlockedUserPendingMatches(uid, otherUid, snapshot.val())
      }
      admin.database().ref(`Users/${uid}/matchIDs`)
        .once("value")
        .then(subsnap => {
          if(subsnap.val()) {
            removeBlockedUserMatches(uid, otherUid, subsnap.val())
          }
        })
        updates[`/Users/${uid}/blockedUsers/${otherUid}`] = otherUserNameAndAvatar;
        updates[`/Chats/${uid}/${otherUid}`] = null
        updates[`/Chats/${otherUid}/${uid}`] = null
        try {
          admin.database().ref().update(updates)
          return BLOCK_SUCCESS
        } catch(err) {
          console.log("Block user error: " + err)
          return BLOCK_FAILURE
        }
      }
    )
    // Deleting the chat and conversation + metadata
  }

  exports.unblockUser = async(data, context) => {
    let otherUid = data.otherUid
    let updates = {}
    let uid = await admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        return decodedToken.uid;
    })
    if(uid == null) {
      console.log("Unauthorized request unblockUser")
      return {
        success: false,
        message: UNBLOCK_FAILURE,
      }
    }
    updates[`/Users/${uid}/blockedUsers/${otherUid}`] = null;
    try {
      await admin.database().ref().update(updates)
      return UNBLOCK_SUCCESS
    } catch(err) {
      console.log("Block user error: " + err)
      return UNBLOCK_FAILURE
    }
}

async function getMinimumReportAdmin(uid, otherUserId) {
    let admins;
    let involvedParties = [uid, otherUserId]
    await admin.database()
    .ref('ReportCount')
    .once("value", (snapshot) => {
      admins = snapshot.val()
    });
    let minimumReportAdmin = ['', 2000000];
    for (let admin in admins) {
      if(admins[admin] < minimumReportAdmin[1] && !involvedParties.includes(admin)) {
        minimumReportAdmin = [admin, admins[admin]];
      }
    }
    return minimumReportAdmin;
}

async function getNumberOfComplaints(otherUserId) {
    let res; 
    await admin.database().ref(`ComplaintCount/${otherUserId}`)
    .once("value", snapshot => snapshot.val() ? res = snapshot.val() : res = 0)
    return res;
}

async function getDateJoined(otherUserId) {
    let res;
    await admin.database().ref(`Users/${otherUserId}/dateJoined`)
    .once("value").then(snapshot => res = snapshot.val()).catch(err => console.log(err))
    return res;
}

exports.makeReport = async(data, context) => {
    let otherUserId = data.otherUserId;
    let complaint = data.complaint;
    let datetime = data.datetime;
    let updates = {}
    let uid = await admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        return decodedToken.uid;
    })
    if(uid == null) {
      console.log("Unauthorized request unblockUser")
      return {
        success: false,
        message: MAKE_REPORT_FAILURE,
      }
    }
    let minimumReportAdmin = await getMinimumReportAdmin(uid, otherUserId);
    let numComplaints = await getNumberOfComplaints(otherUserId);
    let dateJoined = await getDateJoined(otherUserId)
    let key = await admin.database().ref().push().key

    updates[`/Reports/${minimumReportAdmin[0]}/${key}`] = {complaint: complaint, datetime: datetime, plaintiff: uid, defendant: otherUserId, dateJoined: dateJoined, complaintCount: numComplaints+1}
    updates[`/ReportCount/${minimumReportAdmin[0]}`] = minimumReportAdmin[1]+1;
    updates[`/ComplaintCount/${otherUserId}`] = numComplaints+1;
    updates[`/ComplaintHistory/${otherUserId}/${key}`] = {complaint: complaint, datetime: datetime, plaintiff: uid, defendant: otherUserId}

    try {
      await admin.database().ref().update(updates)
      return {
        success: true,
        message: MAKE_REPORT_SUCCESS,
      }
    } catch(err) {
      console.log("makeReport error: " + err)
      return {
        success: false,
        message: MAKE_REPORT_FAILURE,
      }
    }
  }

  async function getNumberOfReports(uid) {
    let res;
    await admin.database().ref(`/ReportCount/${uid}`)
    .once('value', snapshot => {
      res = snapshot.val()
    })
    return res;
  }

  exports.deleteReport = async(data, context) => {
    let reportID = data.reportID
    let updates = {}
    let uid = await admin
    .auth()
    .verifyIdToken(data.idToken)
    .then(decodedToken => {
        return decodedToken.uid;
    }).catch(err => {
        console.log('Verification error')
        return {
            success: false,
            message: DELETE_REPORT_FAILURE,
        }
    })
    if(uid == null) {
      console.log("Unauthorized request deleteReport")
      return {
        success: false,
        message: DELETE_REPORT_FAILURE,
      }
    }
    let numReports = await getNumberOfReports(uid)
    let x = numReports-1;
    updates[`/Reports/${uid}/${reportID}`] = null;
    updates[`/ReportCount/${uid}`] = x;
    try {
      await admin.database().ref().update(updates);
      return {
          success: true,
          message: DELETE_REPORT_SUCCESS
      }
    } catch(err) {
      console.log("delete report error " + err);
      return {
        success: true,
        message: DELETE_REPORT_FAILURE
      }
    }
  }