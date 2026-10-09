import { Task, TaskFields, newId } from './task';

// Everything the user does becomes one of these events. occurredAt is the device clock in UTC.
export type TaskEvent = TaskChangeEvent | TaskDeleteEvent;

export interface TaskChangeEvent {
  eventId: string;
  taskId: string;
  type: 'create' | 'update';
  occurredAt: string;
  fields: TaskFields;
}

export interface TaskDeleteEvent {
  eventId: string;
  taskId: string;
  type: 'delete';
  occurredAt: string;
}

export function newChangeEvent(type: 'create' | 'update', taskId: string, fields: TaskFields): TaskChangeEvent {
  return { eventId: newId(), taskId, type, occurredAt: new Date().toISOString(), fields };
}

export function newDeleteEvent(taskId: string): TaskDeleteEvent {
  return { eventId: newId(), taskId, type: 'delete', occurredAt: new Date().toISOString() };
}

// What the screen shows: the server list with the outbox events applied on top.
// - Events apply from the oldest occurredAt to the most recent, so the most recent wins.
// - An event for a task the list does not have creates it.
// - A delete wins over any other event, before or after it.
export function applyEvents(serverTasks: Task[], outboxEvents: TaskEvent[]): Task[] {
  const tasksById = new Map(serverTasks.map((task) => [task.id, task]));

  const changeEvents = outboxEvents
    .filter((event): event is TaskChangeEvent => event.type !== 'delete')
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt));

  for (const changeEvent of changeEvents) {
    const taskInList = tasksById.get(changeEvent.taskId);
    const createdAt = taskInList?.createdAt ?? changeEvent.occurredAt;

    tasksById.set(changeEvent.taskId, { ...changeEvent.fields, id: changeEvent.taskId, createdAt });
  }

  for (const deleteEvent of outboxEvents.filter((event) => event.type === 'delete')) {
    tasksById.delete(deleteEvent.taskId);
  }

  return [...tasksById.values()];
}
