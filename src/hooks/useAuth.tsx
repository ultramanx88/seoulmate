import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { apiRequest, setAuthTokenGetter } from '../lib/api';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleDataOperationError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path,
  };
  console.error('Data operation error:', JSON.stringify(errInfo));
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
  plan?: 'free' | 'pro' | 'pro_unlimited';
  isProfileComplete: boolean;
  lastActiveAt?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const clerkAuth = useClerkAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!clerkAuth.isSignedIn) {
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      const result = await apiRequest<{ user: UserProfile; profile: UserProfile }>('/v1/auth/me');
      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
      const clerkName = clerkUser?.fullName ?? clerkUser?.username ?? clerkEmail ?? null;
      const clerkPhoto = clerkUser?.imageUrl ?? '';
      const mergedProfile = {
        ...result.profile,
        email: result.profile.email ?? clerkEmail,
        displayName: result.profile.displayName === 'Seoulmate user' && clerkName
          ? clerkName
          : result.profile.displayName,
        photoURL: result.profile.photoURL || clerkPhoto,
        photoUrl: result.profile.photoUrl || clerkPhoto || null,
      };
      setUser(mergedProfile);
      setProfile(mergedProfile);
    } catch {
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    setAuthTokenGetter(() => clerkAuth.getToken());
    return () => setAuthTokenGetter(null);
  }, [clerkAuth.getToken]);

  useEffect(() => {
    if (!clerkAuth.isLoaded || !clerkUserLoaded) return;
    setLoading(true);
    refreshProfile().finally(() => setLoading(false));
  }, [clerkAuth.isLoaded, clerkAuth.isSignedIn, clerkUserLoaded, clerkUser?.id]);

  const logout = async () => {
    await clerkAuth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
