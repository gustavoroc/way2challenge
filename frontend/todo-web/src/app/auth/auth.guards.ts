import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// An expired session still opens the tasks: the user keeps working offline until logging in again.
export const signedInGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.session()) return true;

  return inject(Router).parseUrl('/login');
};

export const signedOutGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.session() || auth.isExpired()) return true;

  return inject(Router).parseUrl('/tasks');
};
