// WhatsApp seller-contact: phone helpers + protected number storage + the
// authenticated RPC that validates, records interest and returns the number.
import { supabase } from './supabase';

export type InterestReason = 'buy' | 'offer' | 'question' | 'trade';

export interface WhatsappInfo {
  number: string;        // national digits only, e.g. 11999999999
  countryCode: string;   // e.g. 55
  consent: boolean;
}

/** Editing state used by the create/edit form's WhatsApp section. */
export interface WhatsappDraft {
  enabled: boolean;
  info: WhatsappInfo | null;
  saveToProfile: boolean;
}
export const emptyWhatsappDraft: WhatsappDraft = { enabled: false, info: null, saveToProfile: false };

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

/** Format Brazilian national digits as "(11) 99999-9999" while typing. */
export function maskBR(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Partially-masked display, e.g. "(11) 9••••-1234". */
export function maskPartial(number: string): string {
  const d = onlyDigits(number);
  if (d.length < 6) return maskBR(d) || '••••';
  const ddd = d.slice(0, 2);
  const last4 = d.slice(-4);
  return `(${ddd}) ${d.length >= 11 ? '9' : ''}••••-${last4}`;
}

/** Valid Brazilian national number (10 = landline, 11 = mobile with 9). */
export const isValidBR = (number: string): boolean => {
  const len = onlyDigits(number).length;
  return len === 10 || len === 11;
};

/** A draft is publishable only with a valid number and the consent box ticked. */
export const isWhatsappValid = (d: { info: WhatsappInfo | null }): boolean =>
  !!d.info && isValidBR(d.info.number) && d.info.consent;

// ---- per-listing number (owner only) ----------------------------------------
export async function fetchListingWhatsapp(listingId: string): Promise<WhatsappInfo | null> {
  const { data, error } = await sb().from('listing_whatsapp').select('number,country_code,consent').eq('listing_id', listingId).maybeSingle();
  if (error) throw error;
  return data ? { number: data.number, countryCode: data.country_code, consent: data.consent } : null;
}

export async function saveListingWhatsapp(listingId: string, info: WhatsappInfo): Promise<void> {
  const { error } = await sb().from('listing_whatsapp').upsert({
    listing_id: listingId, number: info.number, country_code: info.countryCode,
    consent: info.consent, consent_date: info.consent ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function clearListingWhatsapp(listingId: string): Promise<void> {
  const { error } = await sb().from('listing_whatsapp').delete().eq('listing_id', listingId);
  if (error) throw error;
}

// ---- profile default number (owner only) ------------------------------------
export async function fetchMyWhatsapp(userId: string): Promise<WhatsappInfo | null> {
  const { data, error } = await sb().from('user_whatsapp').select('number,country_code,consent').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { number: data.number, countryCode: data.country_code, consent: data.consent } : null;
}

export async function saveMyWhatsapp(userId: string, info: WhatsappInfo): Promise<void> {
  const { error } = await sb().from('user_whatsapp').upsert({
    user_id: userId, number: info.number, country_code: info.countryCode, consent: info.consent, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ---- the contact RPC + link builder -----------------------------------------
/** Validates + records interest server-side, returns the full digits number. */
export async function whatsappContact(listingId: string, reason: InterestReason, message: string): Promise<string> {
  const { data, error } = await sb().rpc('whatsapp_contact', { p_listing_id: listingId, p_reason: reason, p_message: message });
  if (error) throw error;
  return (data as { number: string }).number;
}

export function buildWhatsappUrl(fullNumber: string, message: string): string {
  return `https://wa.me/${onlyDigits(fullNumber)}?text=${encodeURIComponent(message)}`;
}

// ---- interest lists (Dashboard) ---------------------------------------------
export interface InterestEntry {
  id: string; listingId: string; listingName: string; listingImage: string | null;
  reason: string; message: string; createdAt: number; otherId: string; otherNick: string; otherAvatar: string;
}
interface InterestJoinRow {
  id: string; listing_id: string; reason: string; message: string; created_at: string;
  listing: { name: string; image_url: string } | null;
  other: { id: string; nick: string; avatar_url: string | null } | null;
}
const toEntry = (r: InterestJoinRow): InterestEntry => ({
  id: r.id, listingId: r.listing_id, listingName: r.listing?.name ?? '—', listingImage: r.listing?.image_url ?? null,
  reason: r.reason, message: r.message, createdAt: new Date(r.created_at).getTime(),
  otherId: r.other?.id ?? '', otherNick: r.other?.nick ?? '—', otherAvatar: r.other?.avatar_url || '🧑',
});

/** Items the current user showed interest in (as buyer). */
export async function fetchMyInterests(userId: string): Promise<InterestEntry[]> {
  const { data, error } = await sb().from('interests')
    .select('id,listing_id,reason,message,created_at,listing:listings!listing_id(name,image_url),other:profiles!seller_id(id,nick,avatar_url)')
    .eq('buyer_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as InterestJoinRow[]).map(toEntry);
}

/** People who showed interest in the current user's items (as seller). */
export async function fetchInterestsReceived(userId: string): Promise<InterestEntry[]> {
  const { data, error } = await sb().from('interests')
    .select('id,listing_id,reason,message,created_at,listing:listings!listing_id(name,image_url),other:profiles!buyer_id(id,nick,avatar_url)')
    .eq('seller_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as InterestJoinRow[]).map(toEntry);
}
