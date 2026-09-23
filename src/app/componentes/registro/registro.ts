import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  registerForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
    fecha_nacimiento: [''],
    tipo_sangre: [''],
    color_ojos: [''],
    dias_vacaciones: ['']
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { noCoinciden: true };
    }
    return null;
  }// Valida que la contraseña y su confirmacion sean exactamente iguales

  async onSubmitRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    try {
      const { confirmPassword, ...datosUsuario } = this.registerForm.value;
      const nuevoUsuario = {
        ...datosUsuario,
        fecha_nacimiento: datosUsuario.fecha_nacimiento || null,
        dias_vacaciones: datosUsuario.dias_vacaciones ? Number(datosUsuario.dias_vacaciones) : null,
        rol: 'cliente'
      };
      await this.authService.registrarUsuario(nuevoUsuario);
      this.successMessage.set('¡Registro exitoso! Redirigiendo...');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1500);

    } catch (error: any) {
      console.error('Error al registrar:', error);
      this.errorMessage.set('Hubo un error al registrarse. Verifica los datos.');
    }
  }
}
