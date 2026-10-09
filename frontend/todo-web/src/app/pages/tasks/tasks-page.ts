import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TaskStore } from '../../state/task-store';
import { Task } from '../../task';
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from '../labels';
import { NO_FILTER, TaskFilter, isUrgent, matchesFilter, sortTasks } from './task-list';

@Component({
  selector: 'app-tasks-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './tasks-page.html',
})
export class TasksPage {
  private readonly taskStore = inject(TaskStore);

  readonly priorities = PRIORITIES;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly isUrgent = isUrgent;

  readonly filterForm = inject(FormBuilder).nonNullable.group({
    searchText: NO_FILTER.searchText,
    status: NO_FILTER.status as TaskFilter['status'],
    priority: NO_FILTER.priority as TaskFilter['priority'],
    category: NO_FILTER.category,
  });

  private readonly selectedFilter = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: NO_FILTER },
  );

  readonly filteredAndSortedTasks = computed(() =>
    sortTasks(this.taskStore.tasks().filter((task) => matchesFilter(task, this.selectedFilter()))),
  );

  readonly categoriesInUse = computed(() =>
    [...new Set(this.taskStore.tasks().flatMap((task) => (task.category ? [task.category] : [])))].sort(),
  );

  complete(task: Task): void {
    void this.taskStore.update({ ...task, status: 'done' });
  }

  reopen(task: Task): void {
    void this.taskStore.update({ ...task, status: 'pending' });
  }

  remove(task: Task): void {
    void this.taskStore.delete(task);
  }
}
