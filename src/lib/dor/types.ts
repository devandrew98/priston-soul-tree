// Record shapes of the pain diary. The database stores them as generic versioned rows (supabase/35_dor_diary.sql);
// `data` holds one of the shapes below. Instants are ISO strings (UTC); calendar days are 'YYYY-MM-DD' in the diary's time zone.
export type Kind = 'settings' | 'crisis' | 'intensity' | 'symptom' | 'med' | 'med_admin' | 'therapy' | 'sleep' | 'nopain' | 'alert_rule';

export interface Rec<T extends object = object> {
  id: string; kind: Kind; data: T; eventAt: string | null; version: number;
  createdAt: string; updatedAt: string; deletedAt: string | null;
}

export interface Settings { tz: string; doctor: string }
export interface Crisis {
  start: string; end?: string;
  location: string[]; character: string[]; symptoms: string[]; factors: string[];
  note?: string; endNote?: string;
  /** Each time the crisis was reopened: when, and the end it had before. */
  reopened?: { at: string; prevEnd: string }[];
}
export interface Intensity { crisisId?: string; at: string; value: number; note?: string; /** reassessment after this medication administration */ afterAdminId?: string }
export interface SymptomUpdate { crisisId: string; at: string; symptoms: string[]; note?: string }

export type MedCategory = 'crisis' | 'continuous';
export interface Med {
  name: string; dose: string; unit: string; category: MedCategory; order: number; active: boolean;
  /** continuous medication schedule */
  habitualTime?: string; startDate?: string; endDate?: string; frequency?: string;
}
export interface MedAdmin {
  medId: string;
  /** Snapshot of the medication at the time: later edits of the catalogue never change what was given. */
  name: string; dose: string; unit: string; category: MedCategory;
  quantity: number; at: string; crisisId?: string; note?: string;
  /** 'omitted' = the person said explicitly that the dose was skipped. No record at all means "not recorded". */
  status: 'taken' | 'omitted';
}
export type TherapyType = 'start' | 'dose' | 'frequency' | 'suspend' | 'restart' | 'note';
export interface Therapy { medId: string; name: string; date: string; type: TherapyType; from?: string; to?: string; note?: string }
export interface Sleep { date: string; hours?: number; quality?: 'boa' | 'regular' | 'ruim'; note?: string }
export interface NoPain { date: string }
/** Alert criteria are configured by the doctor in the system; none comes pre-filled. */
export interface AlertRule { name: string; active: boolean; scope: 'any_crisis_med' | 'med'; medId?: string; windowDays: number; maxDays: number }

export type DayState = 'headache' | 'nopain' | 'unknown';
