// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCnutCxfRB9dr9uDFGvBf_NVnpXVqf3nCw",
    authDomain: "cresco-water.firebaseapp.com",
    projectId: "cresco-water",
    storageBucket: "cresco-water.firebasestorage.app",
    messagingSenderId: "1042921013030",
    appId: "1:1042921013030:web:9fa698efa12744afc64be7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Optional: Enable persistence for offline support
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Persistence failed');
        } else if (err.code == 'unimplemented') {
            console.log('Persistence not available');
        }
    });

console.log('Firebase initialized successfully');