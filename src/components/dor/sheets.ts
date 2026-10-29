import type { MedPick } from './forms';
import type { Crisis, Rec } from '../../lib/dor/types';

/** Which quick form is open on top of the screen. */
export type SheetState =
  | { t: 'crisis'; startAt?: string }
  | { t: 'choice' }
  | { t: 'reopen'; rec: Rec<Crisis> }
  | { t: 'end'; rec: Rec<Crisis> }
  | { t: 'intensity'; crisisId?: string; afterAdminId?: string; heading?: string }
  | { t: 'symptom'; rec: Rec<Crisis> }
  | { t: 'med'; pick?: MedPick }
  | { t: 'sleep'; date?: string }
  | { t: 'edit'; rec: Rec }
  | { t: 'settings' }
  | null;
export type Open = (s: SheetState) => void;
