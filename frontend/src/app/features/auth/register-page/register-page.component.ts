import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AppError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './register-page.component.html',
  styleUrls: ['./register-page.component.scss'],
})
export class RegisterPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public readonly isSubmitting = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly hidePassword = signal(true);

  public readonly registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    dateOfBirth: [new Date(), [Validators.required]],
    phoneNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
    appCode: ['', [Validators.required, Validators.maxLength(50)]],
  }, { validators: passwordMatchValidator });

  public togglePassword(): void {
    this.hidePassword.update((hide) => !hide);
  }

  public onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.registerForm.getRawValue();
    
    // Convert date of birth to ISO string
    let dateOfBirthIso = '';
    if (formValue.dateOfBirth) {
      dateOfBirthIso = new Date(formValue.dateOfBirth).toISOString();
    }

    const payload = {
      username: formValue.username,
      email: formValue.email,
      password: formValue.password,
      dateOfBirth: dateOfBirthIso,
      phoneNumber: formValue.phoneNumber,
      appCode: formValue.appCode,
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err instanceof AppError
            ? err.message
            : 'Registration failed. Please check your details and try again.',
        );
        console.error('Registration error', err);
      },
    });
  }
}
