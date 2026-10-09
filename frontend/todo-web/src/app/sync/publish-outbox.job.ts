import { Injectable, Injector, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { exhaustMap, fromEvent, interval, merge, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OutboxRepository } from '../database/outbox-repository';
import { TaskApi } from '../http/task-api';
import { TaskStore } from '../state/task-store';
import { SyncStatusService } from './sync-status.service';

const EVERY_5_SECONDS = 5_000;

// JOB 1, on login, every 5 s and as soon as the connection comes back: sends the whole outbox to the server.
// An event leaves the outbox only after the server answers 2xx. On failure it waits for the next round.
@Injectable({ providedIn: 'root' })
export class PublishOutboxJob {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxRepository);
  private readonly taskApi = inject(TaskApi);
  private readonly taskStore = inject(TaskStore);
  private readonly syncStatus = inject(SyncStatusService);
  private readonly injector = inject(Injector);

  // When the next round starts, for the countdown in the header.
  readonly nextRunAt = signal(Date.now() + EVERY_5_SECONDS);

  start(): void {
    const onLogin = toObservable(this.auth.session, { injector: this.injector });
    const every5Seconds = interval(EVERY_5_SECONDS).pipe(tap(() => this.nextRunAt.set(Date.now() + EVERY_5_SECONDS)));
    const onConnectionBack = fromEvent(window, 'online');
    this.nextRunAt.set(Date.now() + EVERY_5_SECONDS);

    merge(onLogin, every5Seconds, onConnectionBack)
      .pipe(exhaustMap(() => this.publishOutbox()))
      .subscribe();
  }

  private async publishOutbox(): Promise<void> {
    if (!this.syncStatus.canSync()) return;

    const eventsInOutbox = await this.outbox.readEvents();
    if (eventsInOutbox.length === 0) return;

    await this.syncStatus.track(async () => {
      await this.taskApi.sendEvents(eventsInOutbox);

      this.taskStore.keepSentEvents(eventsInOutbox);
      await this.outbox.remove(eventsInOutbox);
    });
  }
}
