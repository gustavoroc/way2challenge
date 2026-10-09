import Dexie, { Table } from 'dexie';
import { TaskEvent } from '../task-event';

// The only thing stored on the device: events the server has not received yet. One database per user.
export class OutboxDatabase extends Dexie {
  events!: Table<TaskEvent, string>;

  constructor(readonly userId: string) {
    super(`todo-outbox-${userId}`);
    this.version(1).stores({ events: 'eventId, occurredAt' });
  }
}
