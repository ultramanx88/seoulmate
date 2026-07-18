export const authProviders = ['google', 'line', 'kakao', 'naver'] as const;

export type AuthProvider = typeof authProviders[number];

export type AppUserRow = {
  id: string;
  auth_provider: string;
  provider_subject: string | null;
  email: string | null;
  email_verified: boolean;
  display_name: string;
  photo_url: string | null;
  nationality: 'TH' | 'KR' | null;
  intent: 'dating' | 'friendship' | 'exchange' | null;
  interests: string[];
  languages: string[];
  bio: string | null;
  is_profile_complete: boolean;
  last_active_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ProviderProfile = {
  provider: AuthProvider;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  photoUrl: string | null;
};

export type UserProfileUpdate = {
  displayName?: string;
  nationality?: 'TH' | 'KR';
  intent?: 'dating' | 'friendship' | 'exchange';
  bio?: string;
};

export type PublicUserProfile = {
  uid: string;
  id: string;
  authProvider: string;
  providerSubject: string | null;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  photoUrl: string | null;
  nationality?: 'TH' | 'KR';
  intent?: 'dating' | 'friendship' | 'exchange';
  interests: string[];
  languages: string[];
  bio: string;
  isProfileComplete: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toUserProfile(row: AppUserRow): PublicUserProfile {
  return {
    uid: row.id,
    id: row.id,
    authProvider: row.auth_provider,
    providerSubject: row.provider_subject,
    email: row.email,
    emailVerified: row.email_verified,
    displayName: row.display_name,
    photoURL: row.photo_url ?? '',
    photoUrl: row.photo_url,
    nationality: row.nationality ?? undefined,
    intent: row.intent ?? undefined,
    interests: row.interests ?? [],
    languages: row.languages ?? [],
    bio: row.bio ?? '',
    isProfileComplete: row.is_profile_complete,
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function isProvider(value: string): value is AuthProvider {
  return authProviders.includes(value as AuthProvider);
}
