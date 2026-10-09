export type Priority = 'low' | 'medium' | 'high';
export type Status = 'pending' | 'done';

export const TASK_LIMITS = {
  title: 200,
  description: 2000,
  category: 50,
};

export interface TaskFields {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: Priority;
  status: Status;
  category: string | null;
}

export interface Task extends TaskFields {
  id: string;
  createdAt: string;
}

export function fieldsOf(task: Task): TaskFields {
  const { id, createdAt, ...fields } = task;

  return fields;
}

// UUID v7: the first 48 bits are the creation time, so the database index stays in insertion order.
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  let time = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
