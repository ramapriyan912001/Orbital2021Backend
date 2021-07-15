const fetcher = require('node-fetch');
const {admin} = require("../utils/admin");
const { getPushToken, sendPushNotification} = require("./MatchingHelpers");

// To send a message, we call the send method from GiftedChat component in onSend property as such: onSend={firebaseSvc.send}
// The send method in Firebase.js is:
exports.sendMessageNotif = (data, context) => {
  const { otherUserID, text, idToken } = data;
  return admin
  .auth()
  .verifyIdToken(idToken)
  .then(async payload => {
    try {
      const pushToken = await getPushToken(otherUserID);
      sendPushNotification(pushToken, payload.name, text);
      return ({
        success: true,
        message: 'Message sent successfully'
      });
    } catch (err) {
      return ({
        success: false,
        message: `Push Notification Error: ${err.message}`
      })
    }
  })
  .catch((err) => ({
    success: false,
    message: `idToken Verify Error: ${err.message}`
  }));
}
  