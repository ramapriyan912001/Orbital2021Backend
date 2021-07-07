const admin = require("firebase-admin");
require('dotenv/config');

const serviceAccount = require(process.env.SERVICE_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gobble-b3dfa-default-rtdb.asia-southeast1.firebasedatabase.app"
});

//BASIC AUTH FUNCTIONS
function createAuthUser (user) {
  return admin
  .auth()
  .createUser({
    email: user.email,
    emailVerified: !(user.verified == null),
    phoneNumber: user.phone == null ? '' : user.phone,
    password: user.password,
    displayName: user.name,
    photoURL: user.avatar == null ? 'empty_avatar' : user.avatar,
    disabled: !(user.disabled == null),
  })
  .then((userRecord) => {
    console.log('ADMIN: Successfully created new user:', userRecord.uid);
    return userRecord;
  })
  .catch((error) => {
    console.log('ADMIN: Error creating new user:', error.message);
    return {};
  });
}

function updateFullAuthUser (user) {
  return admin
  .auth()
  .updateUser(user.uid, {
    email: user.email,
    phoneNumber: user.phone,
    emailVerified: user.verified,
    password: user.password,
    displayName: user.name,
    photoURL: user.avatar,
    disabled: user.disabled
  })
  .then((userRecord) => {
    // See the UserRecord reference doc for the contents of userRecord.
    const userInfo = userRecord.toJSON();
    console.log('ADMIN: Successfully updated user', userInfo);
    return userInfo;
  })
  .catch((error) => {
    console.log('ADMIN: Error updating user:', error.message);
    return {};
  });
}

function deleteUserByUID (uid) {
  return admin
  .auth()
  .deleteUser(uid)
  .then(() => {
    console.log('ADMIN: Successfully deleted user');
    return true;
  })
  .catch((error) => {
    console.log('ADMIN: Error deleting user:', error.message);
    return false;
  });
}

function deleteUsersByUID (uids) {
  return admin
  .auth()
  .deleteUsers(uids)
  .then((deleteUsersResult) => {
    console.log(`ADMIN: Successfully deleted ${deleteUsersResult.successCount} users`);
    if (deleteUsersResult.failureCount < 1) {
      return true;
    } else {
      console.log(`ADMIN: Failed to delete ${deleteUsersResult.failureCount} users`);
      deleteUsersResult.errors.forEach((err) => {
        console.log('ADMIN: ', err.error.toJSON());
      });
      return false;
    }
  })
  .catch((error) => {
    console.log('Error deleting users:', error);
    return false;
  });
}