import app from 'firebase/app';

var firebaseConfig = {
    apiKey: "AIzaSyBlJNZPlrf0tbPwglJm_0Dun7pNWAOVTfU",
    authDomain: "test-1-fbadc.firebaseapp.com",
    databaseURL: "https://test-1-fbadc.firebaseio.com",
    projectId: "test-1-fbadc",
    storageBucket: "test-1-fbadc.appspot.com",
    messagingSenderId: "221557899841",
    appId: "1:221557899841:web:276c40ec1254f4c879bcc0",
    measurementId: "G-T319603820"
  };


class Firebase {
    constructor() {
      app.initializeApp(firebaseConfig);
    }
  }

export default Firebase;