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

/**
 * Human-friendly (PT) message for a Supabase auth error. When the project's
 * e-mail server (SMTP) is missing/misconfigured, GoTrue returns a literal
 * "{}" body — the raw message is useless, so we translate the common cases
 * and never show "{}" to the player.
 */
export function authErrMsg(e: unknown): string {
  const obj = (typeof e === 'object' && e !== null ? e : {}) as {
    message?: string;
    msg?: string;
    error_description?: string;
    status?: number;
  };
  const raw = (e instanceof Error ? e.message : obj.msg || obj.message || obj.error_description || String(e ?? '')) || '';
  const m = raw === '{}' || raw === '[object Object]' ? '' : raw;
  const status = obj.status;
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists|duplicate/i.test(m)) return 'Este e-mail já está cadastrado.';
  if (/password should be at least/i.test(m)) return 'A senha deve ter no mínimo 6 caracteres.';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
  if (/unable to validate email|invalid email|invalid format/i.test(m)) return 'E-mail inválido.';
  if (/provider is not enabled|oauth/i.test(m)) return 'Login com Google ainda não está habilitado.';
  if (/rate limit|too many|over_email_send_rate/i.test(m) || status === 429)
    return 'Muitas tentativas — aguarde alguns minutos e tente novamente.';
  if (/error sending|smtp|recovery email|confirmation email/i.test(m) || (!m && (status ?? 500) >= 500))
    return 'Não foi possível enviar o e-mail agora — o servidor de e-mail do site está em configuração. Tente novamente mais tarde.';
  return m || 'Falha inesperada no servidor. Tente novamente.';
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
