import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TaskEvent } from '../task-event';
import { OutboxDatabase } from './outbox-database';

@Injectable({ providedIn: 'root' })
export class OutboxRepository {
  private readonly auth = inject(AuthService);
  private openedDatabase: OutboxDatabase | null = null;

  async add(event: TaskEvent): Promise<void> {
    await this.database().events.add(event);
  }

  // Emits the whole outbox again every time an event is added or removed.
  watchEvents(): Observable<TaskEvent[]> {
    const database = this.database();

    return from(liveQuery(() => database.events.orderBy('occurredAt').toArray()));
  }

  readEvents(): Promise<TaskEvent[]> {
    return this.database().events.orderBy('occurredAt').toArray();
  }

  countEvents(): Promise<number> {
    return this.database().events.count();
  }

  async remove(sentEvents: TaskEvent[]): Promise<void> {
    await this.database().events.bulkDelete(sentEvents.map((event) => event.eventId));
  }

  private database(): OutboxDatabase {
    const signedInUserId = this.auth.session()?.userId;
    if (!signedInUserId) throw new Error('No signed-in user.');

    if (this.openedDatabase?.userId !== signedInUserId) {
      this.openedDatabase = new OutboxDatabase(signedInUserId);
    }

    return this.openedDatabase;
  }
}
