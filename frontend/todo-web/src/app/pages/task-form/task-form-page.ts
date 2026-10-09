import { Component, OnInit, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TaskStore } from '../../state/task-store';
import { Priority, TASK_LIMITS, Task, TaskFields } from '../../task';
import { PRIORITIES, PRIORITY_LABELS } from '../labels';
import { notBlank } from '../not-blank.validator';

@Component({
  selector: 'app-task-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './task-form-page.html',
})
export class TaskFormPage implements OnInit {
  private readonly taskStore = inject(TaskStore);
  private readonly router = inject(Router);

  // Filled from /tasks/:taskId/edit. Empty on /tasks/new.
  readonly taskId = input<string>();

  readonly priorities = PRIORITIES;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly limits = TASK_LIMITS;

  readonly taskForm = inject(FormBuilder).nonNullable.group({
    title: ['', [notBlank, Validators.maxLength(TASK_LIMITS.title)]],
    description: ['', Validators.maxLength(TASK_LIMITS.description)],
    dueDate: [''],
    priority: ['medium' as Priority],
    category: ['', Validators.maxLength(TASK_LIMITS.category)],
  });

  private taskBeingEdited: Task | undefined;

  ngOnInit(): void {
    const taskId = this.taskId();
    if (!taskId) return;

    this.taskBeingEdited = this.taskStore.tasks().find((task) => task.id === taskId);
    if (!this.taskBeingEdited) {
      void this.router.navigateByUrl('/tasks');
      return;
    }

    this.taskForm.setValue({
      title: this.taskBeingEdited.title,
      description: this.taskBeingEdited.description ?? '',
      dueDate: this.taskBeingEdited.dueDate ?? '',
      priority: this.taskBeingEdited.priority,
      category: this.taskBeingEdited.category ?? '',
    });
  }

  async save(): Promise<void> {
    if (this.taskForm.invalid) return;

    const formValue = this.taskForm.getRawValue();
    const fields: TaskFields = {
      title: formValue.title.trim(),
      description: formValue.description.trim() || null,
      dueDate: formValue.dueDate || null,
      priority: formValue.priority,
      status: this.taskBeingEdited?.status ?? 'pending',
      category: formValue.category.trim() || null,
    };

    if (this.taskBeingEdited) await this.taskStore.update({ ...this.taskBeingEdited, ...fields });
    else await this.taskStore.create(fields);

    await this.router.navigateByUrl('/tasks');
  }
}
