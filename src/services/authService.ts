import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';

import {
  auth,
} from '../config/firebase';


/*
 * =========================================================
 * LOGIN
 * =========================================================
 */

export async function signIn(
  email: string,
  password: string
): Promise<User> {

  const credential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  return credential.user;
}


/*
 * =========================================================
 * CREATE ACCOUNT
 * =========================================================
 */

export async function signUp(
  email: string,
  password: string
): Promise<User> {

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  return credential.user;
}


/*
 * =========================================================
 * LOGOUT
 * =========================================================
 */

export async function signOutUser(): Promise<void> {

  await signOut(auth);

}


/*
 * =========================================================
 * AUTH STATE
 * =========================================================
 */

export function subscribeToAuthState(
  callback: (
    currentUser: User | null
  ) => void
) {

  return onAuthStateChanged(
    auth,
    callback
  );

}