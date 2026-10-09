import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { API_URL } from '../config';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionToken = inject(AuthService).session()?.token;
  if (!sessionToken || !request.url.startsWith(API_URL)) return next(request);

  const requestWithToken = request.clone({ setHeaders: { Authorization: `Bearer ${sessionToken}` } });

  return next(requestWithToken);
};
