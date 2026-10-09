import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginForm = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly loginError = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { username, password } = this.loginForm.getRawValue();

    try {
      await this.auth.login(username, password);
      await this.router.navigateByUrl('/tasks');
    } catch {
      this.loginError.set('Usuário ou senha inválidos, ou servidor fora do ar.');
    }
  }
}
