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
  linkWithCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from "firebase/firestore";

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
   * Login/Register with Google.
   * Returns { isNewUser } on success or { needsLinking, email, credential }
   * when the email already has an email/password account that needs linking.
   */
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profileDoc = await getDoc(doc(db, "users", result.user.uid));

      if (profileDoc.exists()) {
        setUserProfile(profileDoc.data());
        setNeedsProfile(false);
        await checkAdmin(result.user);
        return { isNewUser: false, user: result.user };
      }

      // Truly new Google user
      setNeedsProfile(true);
      setUserProfile(null);
      await checkAdmin(result.user);
      return { isNewUser: true, user: result.user };
    } catch (err) {
      if (err.code === "auth/account-exists-with-different-credential") {
        // Email already has an email/password account - return info for linking
        const email = err.customData?.email;
        const credential = GoogleAuthProvider.credentialFromError(err);
        return { needsLinking: true, email, credential };
      }
      throw err;
    }
  };

  /**
   * Link a Google credential to an existing email/password account.
   * Signs in with email/password first, then links Google so both methods use the same uid.
   */
  const linkGoogleToAccount = async (email, password, googleCredential) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await linkWithCredential(cred.user, googleCredential);
    await fetchProfile(cred.user);
    await checkAdmin(cred.user);
    return cred.user;
  };

  /**
   * Check if a nickname is available.
   * @param {string} nickname - Nickname to check
   * @param {string} [excludeUid] - UID to exclude (for editing own profile)
   * @returns {Promise<boolean>} true if available
   */
  const checkNicknameAvailable = async (nickname, excludeUid = null) => {
    const q = query(collection(db, "users"), where("nickname", "==", nickname));
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (excludeUid) return snap.docs.every((d) => d.id === excludeUid);
    return false;
  };

  /**
   * Register with email/password and create user profile
   */
  const register = async (email, password, { nickname, firstName, lastName }) => {
    const available = await checkNicknameAvailable(nickname);
    if (!available) {
      const err = new Error("Nickname already taken");
      err.code = "auth/nickname-taken";
      throw err;
    }

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

    const available = await checkNicknameAvailable(nickname, user.uid);
    if (!available) {
      const err = new Error("Nickname already taken");
      err.code = "auth/nickname-taken";
      throw err;
    }

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
    linkGoogleToAccount,
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
