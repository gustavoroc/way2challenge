import { Priority, Status, Task } from '../../task';

export interface TaskFilter {
  searchText: string;
  status: Status | 'all';
  priority: Priority | 'all';
  category: string;
}

export const NO_FILTER: TaskFilter = { searchText: '', status: 'all', priority: 'all', category: '' };

const URGENT_WORD = /\burgente\b/i;

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function isUrgent(task: Task): boolean {
  return URGENT_WORD.test(task.title) || URGENT_WORD.test(task.description ?? '');
}

// Urgent first. Then due date (no date last), priority (high first) and creation time.
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (first, second) =>
      Number(isUrgent(second)) - Number(isUrgent(first)) ||
      compareDueDate(first.dueDate, second.dueDate) ||
      PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority] ||
      first.createdAt.localeCompare(second.createdAt),
  );
}

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
  const searchText = filter.searchText.trim().toLowerCase();
  const titleAndDescription = `${task.title} ${task.description ?? ''}`.toLowerCase();

  return (
    (filter.status === 'all' || task.status === filter.status) &&
    (filter.priority === 'all' || task.priority === filter.priority) &&
    (filter.category === '' || task.category === filter.category) &&
    (searchText === '' || titleAndDescription.includes(searchText))
  );
}

function compareDueDate(firstDueDate: string | null, secondDueDate: string | null): number {
  if (firstDueDate === secondDueDate) return 0;
  if (firstDueDate === null) return 1;
  if (secondDueDate === null) return -1;

  return firstDueDate.localeCompare(secondDueDate);
}
