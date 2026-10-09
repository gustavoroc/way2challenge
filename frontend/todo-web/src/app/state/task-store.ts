import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OutboxRepository } from '../database/outbox-repository';
import { Task, TaskFields, fieldsOf, newId } from '../task';
import { TaskEvent, applyEvents, newChangeEvent, newDeleteEvent } from '../task-event';

// What the screen shows. Lives in memory only: the server list plus the events not in it yet.
@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxRepository);

  private readonly serverTasks = signal<Task[]>([]);

  readonly outboxEvents = toSignal(
    toObservable(this.auth.session).pipe(switchMap((session) => (session ? this.outbox.watchEvents() : of([])))),
    { initialValue: [] },
  );

  // Accepted by the server but left the outbox before the next pull. Without them the task would
  // vanish from the screen between the publish and the pull.
  readonly sentEvents = signal<TaskEvent[]>([]);

  readonly tasks = computed(() => applyEvents(this.serverTasks(), [...this.sentEvents(), ...this.outboxEvents()]));

  constructor() {
    effect(() => {
      this.auth.session();
      this.serverTasks.set([]);
      this.sentEvents.set([]);
    });
  }

  create(fields: TaskFields): Promise<void> {
    return this.outbox.add(newChangeEvent('create', newId(), fields));
  }

  update(task: Task): Promise<void> {
    return this.outbox.add(newChangeEvent('update', task.id, fieldsOf(task)));
  }

  delete(task: Task): Promise<void> {
    return this.outbox.add(newDeleteEvent(task.id));
  }

  keepSentEvents(events: TaskEvent[]): void {
    this.sentEvents.update((sentEvents) => [...sentEvents, ...events]);
  }

  // The new list already contains the events sent before the pull started, so only those are dropped.
  replaceServerTasks(tasksFromServer: Task[], eventsSentBeforePull: TaskEvent[]): void {
    this.serverTasks.set(tasksFromServer);
    this.sentEvents.update((sentEvents) => sentEvents.filter((event) => !eventsSentBeforePull.includes(event)));
  }
}
