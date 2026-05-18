import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { api, getToken, setToken } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const authGeneration = useRef(0);
  const hasToken = Boolean(getToken());

  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState(hasToken ? 'unknown' : 'guest');
  const [isLoadingAuth, setIsLoadingAuth] = useState(hasToken);
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = authState === 'authenticated';
  const authReady = authState !== 'unknown';

  useEffect(() => {
    if (!getToken()) {
      setAuthState('guest');
      setIsLoadingAuth(false);
      return;
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const gen = ++authGeneration.current;
    const token = getToken();
    if (!token) {
      if (gen !== authGeneration.current) return;
      setAuthState('guest');
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }

    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await api.auth.me();
      if (gen !== authGeneration.current) return;
      setUser(currentUser);
      setAuthState('authenticated');
      setAuthError(null);
    } catch {
      if (gen !== authGeneration.current) return;
      setToken(null);
      setUser(null);
      setAuthState('guest');
      setAuthError({ type: 'auth_required', message: 'Prijavite se' });
    } finally {
      if (gen === authGeneration.current) {
        setIsLoadingAuth(false);
      }
    }
  };

  const login = async (email, password) => {
    const gen = ++authGeneration.current;
    setIsLoadingAuth(false);
    const currentUser = await api.auth.login(email, password);
    if (gen !== authGeneration.current) return currentUser;
    setUser(currentUser);
    setAuthState('authenticated');
    setAuthError(null);
    return currentUser;
  };

  const logout = () => {
    authGeneration.current += 1;
    setUser(null);
    setAuthState('guest');
    setToken(null);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        authReady,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        login,
        logout,
        navigateToLogin,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
