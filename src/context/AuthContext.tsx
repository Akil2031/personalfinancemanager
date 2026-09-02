import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  User,
} from 'firebase/auth';

import {
  subscribeToAuthState,
  signOutUser,
} from '../services/authService';


/*
 * =========================================================
 * CONTEXT TYPE
 * =========================================================
 */

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}


/*
 * =========================================================
 * CONTEXT
 * =========================================================
 */

const AuthContext =
  createContext<
    AuthContextType | undefined
  >(undefined);


/*
 * =========================================================
 * PROVIDER
 * =========================================================
 */

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const [
    user,
    setUser,
  ] = useState<User | null>(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  useEffect(() => {

    const unsubscribe =
      subscribeToAuthState(
        (
          currentUser: User | null
        ) => {

          setUser(
            currentUser
          );

          setLoading(false);

        }
      );


    return () => {

      unsubscribe();

    };

  }, []);


  /*
   * =======================================================
   * LOGOUT
   * =======================================================
   */

  async function logout(): Promise<void> {

    await signOutUser();

  }


  /*
   * =======================================================
   * PROVIDER
   * =======================================================
   */

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
      }}
    >

      {children}

    </AuthContext.Provider>
  );
}


/*
 * =========================================================
 * HOOK
 * =========================================================
 */

export function useAuth(): AuthContextType {

  const context =
    useContext(
      AuthContext
    );


  if (!context) {

    throw new Error(
      'useAuth must be used inside AuthProvider'
    );

  }


  return context;
}