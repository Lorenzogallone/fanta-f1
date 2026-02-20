/**
 * @file AuthContext.jsx
 * Provides authentication context with Firebase Auth integration.
 * Supports Email/Password and Google Sign-In with persistent sessions.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const DEFAULT_RANKING = {
  puntiTotali: 0,
  jolly: 0,
  usedLateSubmission: false,
  pointsByRace: {},
  championshipPiloti: [],
  championshipCostruttori: [],
  championshipPts: 0,
};
import { auth, db } from "../services/firebase";

const AuthContext = createContext();

/**
 * Hook to access auth context.
 * @returns {Object} Auth context value
 * @throws {Error} If used outside AuthProvider
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

const googleProvider = new GoogleAuthProvider();

/**
 * Auth provider component. Wraps the app to provide authentication state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  /**
   * Fetch user profile from Firestore users/{uid}
   */
  const fetchProfile = useCallback(async (firebaseUser) => {
    try {
      const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setUserProfile(data);
        setNeedsProfile(false);
        return data;
      } else {
        setUserProfile(null);
        setNeedsProfile(true);
        return null;
      }
    } catch {
      setUserProfile(null);
      setNeedsProfile(true);
      return null;
    }
  }, []);

  /**
   * Ensure ranking/{uid} exists. Creates it with defaults if missing.
   */
  const ensureRankingEntry = useCallback(async (uid, nickname) => {
    try {
      const rankingDoc = await getDoc(doc(db, "ranking", uid));
      if (!rankingDoc.exists()) {
        await setDoc(doc(db, "ranking", uid), { name: nickname, ...DEFAULT_RANKING });
      }
    } catch {
      // Non-critical: ranking entry will be created on next login
    }
  }, []);

  /**
   * Check admin custom claim from ID token
   */
  const checkAdmin = useCallback(async (firebaseUser) => {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      setIsAdmin(tokenResult.claims.admin === true);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const [profile] = await Promise.all([fetchProfile(firebaseUser), checkAdmin(firebaseUser)]);
        if (profile) {
          await ensureRankingEntry(firebaseUser.uid, profile.nickname);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setNeedsProfile(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchProfile, checkAdmin, ensureRankingEntry]);

  /**
   * Login with email and password
   */
  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user);
    await checkAdmin(cred.user);
    return cred.user;
  };

  /**
   * Login/Register with Google. Returns { isNewUser } to signal if profile completion is needed.
   */
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const profileDoc = await getDoc(doc(db, "users", result.user.uid));
    const isNew = !profileDoc.exists();
    if (isNew) {
      setNeedsProfile(true);
      setUserProfile(null);
    } else {
      setUserProfile(profileDoc.data());
      setNeedsProfile(false);
    }
    await checkAdmin(result.user);
    return { isNewUser: isNew, user: result.user };
  };

  /**
   * Register with email/password and create user profile
   */
  const register = async (email, password, { nickname, firstName, lastName }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      email,
      nickname,
      firstName,
      lastName,
      createdAt: Timestamp.now(),
    };
    await setDoc(doc(db, "users", cred.user.uid), profile);
    await ensureRankingEntry(cred.user.uid, nickname);
    setUserProfile(profile);
    setNeedsProfile(false);
    return cred.user;
  };

  /**
   * Complete profile for Google Sign-In users
   */
  const completeProfile = async ({ nickname, firstName, lastName }) => {
    if (!user) throw new Error("No authenticated user");
    const profile = {
      email: user.email,
      nickname,
      firstName,
      lastName,
      createdAt: Timestamp.now(),
    };
    await setDoc(doc(db, "users", user.uid), profile);
    await ensureRankingEntry(user.uid, nickname);
    setUserProfile(profile);
    setNeedsProfile(false);
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  /**
   * Sign out
   */
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setNeedsProfile(false);
  };

  const value = {
    user,
    userProfile,
    isAdmin,
    loading,
    needsProfile,
    login,
    loginWithGoogle,
    register,
    completeProfile,
    resetPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { AuthContext };
