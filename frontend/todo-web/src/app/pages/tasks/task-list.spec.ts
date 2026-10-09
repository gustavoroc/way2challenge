import { Task } from '../../task';
import { isUrgent, sortTasks } from './task-list';

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    title: 'tarefa',
    description: null,
    dueDate: null,
    priority: 'medium',
    status: 'pending',
    category: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('isUrgent', () => {
  it('finds the word in title or description, any case', () => {
    expect(isUrgent(task({ title: 'Ligar URGENTE' }))).toBe(true);
    expect(isUrgent(task({ title: 'Ligar', description: 'é Urgente' }))).toBe(true);
  });

  it('ignores words that only contain it', () => {
    expect(isUrgent(task({ title: 'resolver urgentemente' }))).toBe(false);
  });
});

describe('sortTasks', () => {
  it('puts urgent tasks first, then due date, priority and creation time', () => {
    const tasks = [
      task({ title: 'sem data' }),
      task({ title: 'vence antes', dueDate: '2026-10-02' }),
      task({ title: 'alta', dueDate: '2026-10-05', priority: 'high' }),
      task({ title: 'baixa', dueDate: '2026-10-05', priority: 'low' }),
      task({ title: 'urgente depois', dueDate: '2026-10-09' }),
      task({ title: 'urgente antes', dueDate: '2026-10-03' }),
    ];

    expect(sortTasks(tasks).map((item) => item.title)).toEqual([
      'urgente antes',
      'urgente depois',
      'vence antes',
      'alta',
      'baixa',
      'sem data',
    ]);
  });

  it('breaks ties by creation time', () => {
    const older = task({ title: 'a', createdAt: '2026-10-01T09:00:00.000Z' });
    const newer = task({ title: 'b', createdAt: '2026-10-01T11:00:00.000Z' });
    expect(sortTasks([newer, older]).map((item) => item.title)).toEqual(['a', 'b']);
  });
});
