import {
  initializeApp,
} from 'firebase/app';

import {
  getFirestore,
} from 'firebase/firestore';

import {
  getAuth,
} from 'firebase/auth';


const firebaseConfig = {

  apiKey:
    'AIzaSyDfNYOllCx_NdWyuTl0loPlWBA-sGsIv60',

  authDomain:
    'personalfinancemanager-600df.firebaseapp.com',

  projectId:
    'personalfinancemanager-600df',

  storageBucket:
    'personalfinancemanager-600df.firebasestorage.app',

  messagingSenderId:
    '369324687955',

  appId:
    '1:369324687955:web:bc35cdac97d1a530163ca',
};


const app =
  initializeApp(
    firebaseConfig
  );


export const db =
  getFirestore(app);


export const auth =
  getAuth(app);