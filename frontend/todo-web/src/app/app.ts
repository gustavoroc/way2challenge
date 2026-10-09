import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { interval, map } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { SYNC_LABELS } from './pages/labels';
import { TaskStore } from './state/task-store';
import { PublishOutboxJob } from './sync/publish-outbox.job';
import { PullServerTasksJob } from './sync/pull-server-tasks.job';
import { SyncStatusService } from './sync/sync-status.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly taskStore = inject(TaskStore);
  private readonly router = inject(Router);
  private readonly publishOutboxJob = inject(PublishOutboxJob);
  private readonly pullServerTasksJob = inject(PullServerTasksJob);

  private readonly now = toSignal(interval(1_000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  readonly session = this.auth.session;
  readonly syncStatus = inject(SyncStatusService).status;

  readonly syncStatusLabel = computed(() => {
    const eventsInOutbox = this.taskStore.outboxEvents().length;
    const statusLabel = SYNC_LABELS[this.syncStatus()];

    return eventsInOutbox > 0 ? `${statusLabel} · ${eventsInOutbox} pendente(s)` : statusLabel;
  });

  // With events waiting, the next thing to happen is job 1 sending them; otherwise job 2 refreshing the list.
  readonly nextSyncLabel = computed(() => {
    if (this.taskStore.outboxEvents().length > 0) {
      return `envia em ${this.secondsUntil(this.publishOutboxJob.nextRunAt())} s`;
    }

    return `atualiza em ${this.secondsUntil(this.pullServerTasksJob.nextRunAt())} s`;
  });

  constructor() {
    this.publishOutboxJob.start();
    this.pullServerTasksJob.start();
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  private secondsUntil(timestamp: number): number {
    return Math.max(0, Math.floor((timestamp - this.now()) / 1_000));
  }
}
