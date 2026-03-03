import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ZaloService } from '../../services/zalo.service';
import { RegistrationService } from '../../services/registration.service';

type ViewState = 'form' | 'loading' | 'error';

@Component({
  selector: 'app-complete-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complete-profile-page.component.html',
  styleUrls: ['../../shared/layout.css', './complete-profile-page.component.css'],
})
export class CompleteProfilePageComponent implements OnInit {
  form!: FormGroup;
  state: ViewState = 'form';
  errorMessage = '';
  zaloName = '';
  private zaloUserId = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private zaloService: ZaloService,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    // If already registered, go to card
    const saved = this.registrationService.getSavedCustomer();
    if (saved) {
      this.router.navigate(['/card', saved.customer_code]);
      return;
    }

    const session = this.zaloService.getSession();
    if (session) {
      this.zaloUserId = session.zalo_user_id;
      this.zaloName = session.name;
    }

    this.form = this.fb.group({
      name: [this.zaloName || '', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^0[35789]\d{8}$/)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state = 'loading';
    this.errorMessage = '';

    const phone = this.form.value.phone.trim();
    const name = this.form.value.name.trim();

    this.registrationService.register(name, phone, this.zaloUserId || undefined).subscribe({
      next: (res) => {
        if (res.success) {
          this.registrationService.saveCustomer({
            customer_code: res.customer_code!,
            barcode_value: res.barcode_value!,
            name: res.name!,
            phone: res.phone!,
          });
          this.zaloService.clearSession();

          const extras = !res.existing ? { state: { bonus: true } } : undefined;
          this.router.navigate(['/card', res.customer_code], extras);
        } else {
          this.errorMessage = res.message || 'Đăng ký thất bại';
          this.state = 'error';
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Lỗi kết nối server';
        this.state = 'error';
      },
    });
  }

  retry(): void {
    this.state = 'form';
    this.errorMessage = '';
  }
}
