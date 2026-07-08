// Real authentication + profile layer (Supabase). Only used when BACKEND_ENABLED;
// the mock store handles the demo mode. Kept framework-agnostic — React wiring
// lives in components/market/session.ts.
import { supabase } from './supabase';
import type { Seller } from './types';

export interface ProfileRow {
  id: string;
  nick: string;
  char_class: string;
  level: number;
  clan: string;
  avatar_url: string | null;
  verified: boolean;
  is_admin: boolean;
  is_contributor: boolean;
  banned?: boolean;
  suspended?: boolean;
  rep_tier_override?: string | null;
  created_at: string;
  last_seen: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  nick: string;
  className: string;
  clan: string;
  avatar: string; // emoji glyph or (after login) an uploaded URL
}

function must() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

/** Map a DB profile row to the Seller shape the UI already uses. */
export function profileToSeller(p: ProfileRow): Seller {
  return {
    id: p.id,
    nick: p.nick,
    avatar: p.avatar_url || '🧑',
    className: p.char_class,
    level: p.level,
    clan: p.clan,
    joinedAt: new Date(p.created_at).getTime(),
    lastSeen: new Date(p.last_seen).getTime(),
    online: true,
    verified: p.verified,
    totalSalesValue: 0,
    itemsSold: 0,
    itemsBought: 0,
    ratingAvg: 0,
    ratingCount: 0,
    positivePct: 0,
    avgResponseMin: 0,
    avgCompleteMin: 0,
    reports: 0,
    medals: [],
    repTierOverride: p.rep_tier_override ?? null,
  };
}

/** Sign up with email/password; profile is created server-side by a trigger
 *  from the metadata passed here. Returns whether a session is active (i.e. no
 *  email confirmation required) so the UI can show the right next step. */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean; userId: string | null }> {
  const sb = must();
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        nick: input.nick.trim(),
        char_class: input.className,
        clan: input.clan.trim(),
        // Emoji glyph goes straight into the profile; a data URL would be too big
        // for user metadata, so we store a placeholder and upload the file after.
        avatar_url: input.avatar.startsWith('data:') ? '🧑' : input.avatar,
      },
    },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session, userId: data.user?.id ?? null };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await must().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await must().auth.signOut();
}

/** Start the Google OAuth flow (redirects away, returns to the site logged in). */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await must().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

/** Send a password-reset email; the link returns to the site in recovery mode. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await must().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

/** Set a new password for the (recovery-authenticated) user. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await must().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Mask an email for display: "an****************1022@gmail.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const start = local.slice(0, 2);
  const end = local.length > 6 ? local.slice(-4) : '';
  const stars = '*'.repeat(Math.max(4, local.length - start.length - end.length));
  return `${start}${stars}${end}@${domain}`;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await must().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

/** Upload a file to a public bucket under the user's folder; returns public URL. */
export async function uploadToBucket(bucket: 'avatars' | 'item-images' | 'streamer-covers', userId: string, file: File): Promise<string> {
  const sb = must();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Update the current user's avatar_url. */
export async function updateAvatar(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await must().from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
  if (error) throw error;
}
