// Unified admin data + actions for the panel — real DB when BACKEND_ENABLED,
// mock store otherwise. Admin.tsx renders purely from this model.
import { useEffect, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { LISTINGS, LISTING_BY_ID, REPORTS, SELLERS, SELLER_BY_ID } from '../../lib/market/data';
import * as admin from '../../lib/market/admin';
import { useAdmin, useAuth, useMyListings } from './store';

export interface MReport { id: string; reporterNick: string; targetType: 'item' | 'user'; targetId: string; targetName: string; reason: string; note: string; at: number }
export interface MListing { id: string; name: string; icon: string; image: string | null; sellerId: string; sellerNick: string; price: number; currency: string; status: string; removed: boolean; featured: boolean }
export interface MUser { id: string; nick: string; avatar: string; className: string; level: number; itemsSold: number; reports: number; banned: boolean; suspended: boolean; contributor: boolean; verified: boolean }
export interface MLog { id: string; text: string; at: number }

export interface AdminModel {
  loading: boolean;
  reports: MReport[];
  listings: MListing[];
  users: MUser[];
  logs: MLog[];
  removeListing: (id: string, name: string) => void;
  restoreListing: (id: string, name: string) => void;
  toggleFeatured: (id: string, name: string, next: boolean) => void;
  toggleBan: (id: string, nick: string, next: boolean) => void;
  toggleSuspend: (id: string, nick: string, next: boolean) => void;
  toggleContributor: (id: string, nick: string, next: boolean) => void;
  resolveReport: (id: string, status: 'resolved' | 'dismissed', label: string) => void;
  sendGlobal: (text: string) => void;
}

export function useAdminModel(): AdminModel {
  const { userId } = useAuth();
  const mock = useAdmin();
  const { myListings } = useMyListings();
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [reports, setReports] = useState<MReport[]>([]);
  const [listings, setListings] = useState<MListing[]>([]);
  const [users, setUsers] = useState<MUser[]>([]);
  const [logs, setLogs] = useState<MLog[]>([]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([admin.fetchOpenReports(), admin.fetchAdminListings(), admin.fetchAdminUsers(), admin.fetchAdminLogs()])
      .then(([rep, lis, usr, lg]) => {
        if (cancelled) return;
        setReports(rep);
        setListings(lis.map((l) => ({ ...l, featured: l.highlighted })));
        setUsers(usr.map((u) => ({ ...u, itemsSold: 0, reports: 0 })));
        setLogs(lg);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const reload = () => setTick((x) => x + 1);
  const log = (text: string) => { if (userId) admin.logAdminAction(userId, text).catch(() => {}); };

  if (BACKEND_ENABLED) {
    return {
      loading, reports, listings, users, logs,
      removeListing: (id, name) => { admin.setListingRemoved(id, true).then(() => { log(`Anúncio removido: ${name}`); reload(); }).catch(() => {}); },
      restoreListing: (id, name) => { admin.setListingRemoved(id, false).then(() => { log(`Anúncio restaurado: ${name}`); reload(); }).catch(() => {}); },
      toggleFeatured: (id, name, next) => { admin.setListingFeatured(id, next).then(() => { log(`${next ? 'Destacou' : 'Removeu destaque de'}: ${name}`); reload(); }).catch(() => {}); },
      toggleBan: (id, nick, next) => { admin.setUserFlag(id, { banned: next }).then(() => { log(`${next ? 'Baniu' : 'Desbaniu'} usuário: ${nick}`); reload(); }).catch(() => {}); },
      toggleSuspend: (id, nick, next) => { admin.setUserFlag(id, { suspended: next }).then(() => { log(`${next ? 'Suspendeu' : 'Reativou'} vendedor: ${nick}`); reload(); }).catch(() => {}); },
      toggleContributor: (id, nick, next) => { admin.setUserFlag(id, { is_contributor: next }).then(() => { log(`${next ? 'Concedeu' : 'Removeu'} selo Colaborador: ${nick}`); reload(); }).catch(() => {}); },
      resolveReport: (id, status, label) => { admin.resolveReport(id, status).then(() => { log(`Denúncia ${id.slice(0, 8)}: ${label}`); reload(); }).catch(() => {}); },
      sendGlobal: (text) => { admin.adminBroadcast(text).then(() => { log(`Notificação global: "${text}"`); reload(); }).catch(() => {}); },
    };
  }

  // ---- mock model ----
  const mReports: MReport[] = REPORTS.filter((r) => !mock.resolvedReports.includes(r.id)).map((r) => ({
    id: r.id, reporterNick: r.reporter, targetType: r.targetType, targetId: r.targetId,
    targetName: (r.targetType === 'item' ? LISTING_BY_ID[r.targetId]?.name : SELLER_BY_ID[r.targetId]?.nick) ?? r.targetId,
    reason: r.reason, note: r.note, at: r.at,
  }));
  const mListings: MListing[] = [...myListings, ...LISTINGS].map((l) => ({
    id: l.id, name: l.name, icon: l.icon, image: l.image ?? null, sellerId: l.sellerId,
    sellerNick: SELLER_BY_ID[l.sellerId]?.nick ?? '?', price: l.price, currency: l.currency, status: l.status,
    removed: mock.adminRemoved.includes(l.id), featured: mock.adminFeatured[l.id] ?? l.highlighted,
  }));
  const mUsers: MUser[] = SELLERS.map((u) => ({
    id: u.id, nick: u.nick, avatar: u.avatar, className: u.className, level: u.level, itemsSold: u.itemsSold, reports: u.reports,
    banned: mock.bannedUsers.includes(u.id), suspended: mock.suspendedUsers.includes(u.id), contributor: mock.contributors.includes(u.id), verified: u.verified,
  }));

  return {
    loading: false, reports: mReports, listings: mListings, users: mUsers, logs: mock.logs,
    removeListing: (id, name) => mock.removeListing(id, name),
    restoreListing: (id) => mock.restoreListing(id),
    toggleFeatured: (id, name, next) => mock.toggleFeatured(id, name, next),
    toggleBan: (id, nick) => mock.toggleBan(id, nick),
    toggleSuspend: (id, nick) => mock.toggleSuspend(id, nick),
    toggleContributor: (id, nick) => mock.toggleContributor(id, nick),
    resolveReport: (id, _status, label) => mock.resolveReport(id, label),
    sendGlobal: (text) => mock.sendGlobal(text),
  };
}
