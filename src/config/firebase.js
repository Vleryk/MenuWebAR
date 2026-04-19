import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage"; 

const firebaseConfig = {
  apiKey: "AIzaSyBFCtOn6pDJ-AJ2GrszC6pIrwxep25RHVQ",
  authDomain: "webar-90e15.firebaseapp.com",
  projectId: "webar-90e15",
  storageBucket: "webar-90e15.firebasestorage.app",
  messagingSenderId: "929847211827",
  appId: "1:929847211827:web:3117a5df5487c1bf783046",
  measurementId: "G-03MG79RR31"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// iniciar storage
const storage = getStorage(app);

// exportar storage junto con lotras cosas
export { app, analytics, storage };