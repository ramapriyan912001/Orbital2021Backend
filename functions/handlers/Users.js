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
        firebase.database().ref().update(updates);
        return true;
    } else {
        return false;
    }
};

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