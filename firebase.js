import app from 'firebase/app';

var firebaseConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  };


class Firebase {
    constructor() {
      app.initializeApp(firebaseConfig);
    }
  }

export default Firebase;
