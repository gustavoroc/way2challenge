import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';
import { Task } from '../task';
import { TaskEvent } from '../task-event';

const PAGE_SIZE = 200;

interface TasksPage {
  tasks: Task[];
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class TaskApi {
  private readonly http = inject(HttpClient);

  // The server only accepts the events. It decides the final state of each task on its own.
  async sendEvents(events: TaskEvent[]): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/task-events`, { events }));
  }

  // Final state of the signed-in user's tasks, reading page after page. Deleted tasks are not included.
  async fetchAllTasks(): Promise<Task[]> {
    const tasksFromServer: Task[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = { page, pageSize: PAGE_SIZE };
      const tasksPage = await firstValueFrom(this.http.get<TasksPage>(`${API_URL}/tasks`, { params }));

      tasksFromServer.push(...tasksPage.tasks);
      hasMore = tasksPage.hasMore;
      page++;
    }

    return tasksFromServer;
  }
}
