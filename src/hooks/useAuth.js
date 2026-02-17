/**
 * @file useAuth.js
 * @description Hook to access auth context
 */

import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";

/**
 * Hook to use auth context
 * @returns {Object} Auth context value with user, userProfile, isAdmin, loading, login, register, logout, etc.
 * @throws {Error} If used outside AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
