import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  errorMessage = signal<string>('');

  // formulario de login
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async onSubmitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Completa los campos correctamente');
      return;
    }

    const { email, password } = this.loginForm.value;

    try {
      const data = await this.authService.login(email!, password!);

      if (data) {
        this.errorMessage.set('');
        this.router.navigate(['/inicio']);
      } else {
        this.errorMessage.set('Credenciales incorrectas');
      }
    } catch (err: any) {
      this.errorMessage.set('Credenciales incorrectas');
    }
  }
}
