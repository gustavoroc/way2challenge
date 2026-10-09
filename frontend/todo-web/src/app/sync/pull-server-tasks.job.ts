import { Injectable, Injector, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { exhaustMap, fromEvent, interval, merge, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OutboxRepository } from '../database/outbox-repository';
import { TaskApi } from '../http/task-api';
import { TaskStore } from '../state/task-store';
import { SyncStatusService } from './sync-status.service';

const EVERY_15_SECONDS = 15_000;

// JOB 2, on login, every 15 s and when the connection comes back: brings the final state of the tasks and replaces the list in memory.
// Skips while the outbox has events, so the server always gets them before we read its state.
@Injectable({ providedIn: 'root' })
export class PullServerTasksJob {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxRepository);
  private readonly taskApi = inject(TaskApi);
  private readonly taskStore = inject(TaskStore);
  private readonly syncStatus = inject(SyncStatusService);
  private readonly injector = inject(Injector);

  // When the next round starts, for the countdown in the header.
  readonly nextRunAt = signal(Date.now() + EVERY_15_SECONDS);

  start(): void {
    const onLogin = toObservable(this.auth.session, { injector: this.injector });
    const every15Seconds = interval(EVERY_15_SECONDS).pipe(tap(() => this.nextRunAt.set(Date.now() + EVERY_15_SECONDS)));
    const onConnectionBack = fromEvent(window, 'online');
    this.nextRunAt.set(Date.now() + EVERY_15_SECONDS);

    merge(onLogin, every15Seconds, onConnectionBack)
      .pipe(exhaustMap(() => this.pullServerTasks()))
      .subscribe();
  }

  private async pullServerTasks(): Promise<void> {
    if (!this.syncStatus.canSync()) return;

    const eventsInOutbox = await this.outbox.countEvents();
    if (eventsInOutbox > 0) return;

    const eventsSentBeforePull = this.taskStore.sentEvents();

    await this.syncStatus.track(async () => {
      const tasksFromServer = await this.taskApi.fetchAllTasks();
      this.taskStore.replaceServerTasks(tasksFromServer, eventsSentBeforePull);
    });
  }
}
