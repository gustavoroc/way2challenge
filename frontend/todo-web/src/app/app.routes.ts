import { Routes } from '@angular/router';
import { signedInGuard, signedOutGuard } from './auth/auth.guards';
import { LoginPage } from './pages/login/login-page';
import { TaskFormPage } from './pages/task-form/task-form-page';
import { TasksPage } from './pages/tasks/tasks-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  { path: 'login', component: LoginPage, canActivate: [signedOutGuard] },
  { path: 'tasks', component: TasksPage, canActivate: [signedInGuard] },
  { path: 'tasks/new', component: TaskFormPage, canActivate: [signedInGuard] },
  { path: 'tasks/:taskId/edit', component: TaskFormPage, canActivate: [signedInGuard] },
  { path: '**', redirectTo: 'tasks' },
];
