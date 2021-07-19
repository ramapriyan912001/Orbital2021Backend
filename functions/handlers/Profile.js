const firebase = require("firebase");
const {admin} = require("../utils/admin");
const functions = require('firebase-functions')
const { config } = require("../utils/config");
const fetcher = require('node-fetch')

uploadImage = async uri => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ref = firebase.storage().ref('avatar').child(uuid());
    const task = ref.put(blob);
    return new Promise((resolve, reject) => {
      task.on('state_changed', () => { }, reject, 
        () => resolve(task.snapshot.ref.getDownloadURL()));
    });
  } catch (err) {
    console.log('uploadImage error: ' + err.message); 
  }
}

exports.changeAvatar = async (data, context) => {
    let uri = data.uri;
    let newImage = await this.uploadImage(uri);
    let updates = {}
    updates[`/Users/${this.uid}/avatar`] = newImage
    updates[`/Avatars/${this.uid}`] = newImage
    try {
      await admin.database().ref().update(updates)
    } catch (err) {
      console.log('changeimage error ' + err.message);
    }
}

exports.updateAvatar = (data, context) => {
    let url = data.url;
    //await this.setState({ avatar: url });
    let userf = this.currentUser();
    if (this.userExists()) {
      userf.updateProfile({photoURL: url, avatar: url})
      .then(() => console.log("Updated avatar successfully. URL:" + url))
      .catch((error) => {
        console.log("Avatar Update Error: " + error.message);
        Alert.alert("Error updating avatar. " + error.message);
      });
    } else {
      console.log("can't update avatar, user is not logged in.");
      Alert.alert("Unable to update avatar. You must re-authenticate first.");
      props.navigation.navigate('Reauthentication');
    }
  }