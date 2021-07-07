const admin = require("firebase-admin");
require('dotenv/config');

const serviceAccount = require(process.env.SERVICE_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gobble-b3dfa-default-rtdb.asia-southeast1.firebasedatabase.app"
});
