import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, AuthProvider as OAuthProvider, startOAuth } from '../lib/api';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path,
  };
  console.error('Legacy data operation error:', JSON.stringify(errInfo));
  return errInfo;
}

interface UserProfile {
  uid: string;
  id: string;
  authProvider?: string;
  providerSubject?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  displayName: string;
  photoURL: string;
  photoUrl?: string | null;
  nationality?: 'TH' | 'KR';
  intent?: 'dating' | 'friendship' | 'exchange';
  interests?: string[];
  languages?: string[];
  bio?: string;
  isProfileComplete: boolean;
  lastActiveAt?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (provider?: OAuthProvider) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const result = await apiRequest<{ user: UserProfile; profile: UserProfile }>('/v1/auth/me');
      setUser(result.user);
      setProfile(result.profile);
    } catch {
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, []);

  const login = async (provider: OAuthProvider = 'google') => {
    startOAuth(provider);
  };

  const logout = async () => {
    await apiRequest('/v1/auth/logout', { method: 'POST' });
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
