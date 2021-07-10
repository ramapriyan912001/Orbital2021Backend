const firebase = require("firebase");
const {admin} = require("../utils/admin");
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

exports.deleteUserByUID = (req, res) => {
    return admin
    .auth()
    .deleteUser(req.params.uid)
    .then(() => {
    if (deleteUserCollection(req.params.uid)) {
        console.log('ADMIN: Successfully deleted user');
        return res.status(200).json({
            success: true,
            message: `User ${req.params.uid} has been deleted!`
        });
    } else {
        console.log('ADMIN: Error deleting User Collection');
        return res.status(400).json({
            success: false,
            message: `ADMIN DELETE USER ERROR: Auth deleted but User Collection not deleted fully`
        });
    }
    })
    .catch((error) => {
    if ('auth/user-not-found' === error.message) {
        if (deleteUserCollection(req.params.uid)) {
            console.log('ADMIN: Successfully deleted user from collection ONLY');
            return res.status(200).json({
                success: true,
                message: `User ${req.params.uid} has been deleted!`
            });
        } else {
            console.log('ADMIN: Error deleting User Collection');
            return res.status(400).json({
                success: false,
                message: `ADMIN DELETE USER ERROR: Auth deleted but User Collection not deleted fully`
            });
        }
    } else {
        console.log('ADMIN: Error deleting user:', error.message);
        return res.status(500).json({
            success: false,
            message: `ADMIN DELETE USER ERROR: ${error.message}`
        });
    }
    });
};

exports.deleteUsersByUID = (req, res) => {
    return admin
    .auth()
    .deleteUsers(req.body.body.uids)
    .then((deleteUsersResult) => {
    let totalCount = 0;
    req.body.body.uids
    .map((uid) => deleteUserCollection(uid))
    .filter(isUidDeleted => {
        totalCount++;
        return isUidDeleted;
    });
    if (deleteUsersResult.failureCount < 1 && totalCount < 1) {
        console.log(`ADMIN: Successfully deleted ${deleteUsersResult.successCount} users`);        
        return res.status(200).json({
            success:true,
            message: 'Users deleted'
        });
    } else if (totalCount > 0) {
        console.log(`ADMIN: Failed to delete ${deleteUsersResult.failureCount} users from user collection`);
        return res.status(500).json({
            success: false,
            message: 'Unable to delete all user collections'
        });
    } else {
        deleteUsersResult.errors.forEach((err) => {
        console.log('ADMIN: ', err.error.toJSON());
        });
        return res.status(400).json({
            success: false,
            message: 'Unable to delete all users'
        });
    }
    })
    .catch((error) => {
    console.log('Error deleting users:', error);
    return res.status(500).json({
        success: false,
        message: `ADMIN DELETE USERS ERROR: ${error.message}`
    });
    });
};

// module.exports({ deleteUserByUID, deleteUsersByUID, createAuthUser, updateFullAuthUser });