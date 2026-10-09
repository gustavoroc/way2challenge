import { Task, TaskFields } from './task';
import { TaskEvent, applyEvents } from './task-event';

const fields: TaskFields = {
  title: 'Comprar café',
  description: null,
  dueDate: null,
  priority: 'medium',
  status: 'pending',
  category: null,
};

const taskOnServer: Task = { ...fields, id: 't1', createdAt: '2026-10-01T10:00:00.000Z' };

function change(type: 'create' | 'update', occurredAt: string, changedFields: Partial<TaskFields>): TaskEvent {
  return { eventId: occurredAt, taskId: 't1', type, occurredAt, fields: { ...fields, ...changedFields } };
}

function remove(occurredAt: string): TaskEvent {
  return { eventId: occurredAt, taskId: 't1', type: 'delete', occurredAt };
}

describe('applyEvents', () => {
  it('shows the server list when the outbox is empty', () => {
    expect(applyEvents([taskOnServer], [])).toEqual([taskOnServer]);
  });

  it('creates the task when the list does not have it', () => {
    const [created] = applyEvents([], [change('create', '2026-10-02T10:00:00.000Z', {})]);

    expect(created.title).toBe('Comprar café');
    expect(created.createdAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('applies an update on top of the task from the server', () => {
    const [updated] = applyEvents([taskOnServer], [change('update', '2026-10-02T10:00:00.000Z', { status: 'done' })]);

    expect(updated.status).toBe('done');
    expect(updated.createdAt).toBe(taskOnServer.createdAt);
  });

  it('the most recent event wins, whatever the order in the outbox', () => {
    const [result] = applyEvents(
      [taskOnServer],
      [
        change('update', '2026-10-02T10:05:00.000Z', { title: 'Mais recente' }),
        change('update', '2026-10-02T10:00:00.000Z', { title: 'Mais antigo' }),
      ],
    );

    expect(result.title).toBe('Mais recente');
  });

  it('a delete wins even over a later update', () => {
    const result = applyEvents(
      [taskOnServer],
      [remove('2026-10-02T10:00:00.000Z'), change('update', '2026-10-02T10:05:00.000Z', { title: 'Depois' })],
    );

    expect(result).toEqual([]);
  });
});
