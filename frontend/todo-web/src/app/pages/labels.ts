import { Priority, Status } from '../task';
import { SyncStatus } from '../sync/sync-status.service';

export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export const STATUS_LABELS: Record<Status, string> = { pending: 'Pendente', done: 'Concluída' };

export const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: 'Offline',
  syncing: 'Sincronizando',
  synced: 'Sincronizado',
  error: 'Erro ao sincronizar',
  session_expired: 'Sessão expirada',
};
