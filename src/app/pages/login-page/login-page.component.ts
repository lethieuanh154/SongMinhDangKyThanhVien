import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ZaloService } from '../../services/zalo.service';
import { RegistrationService } from '../../services/registration.service';

type ViewState = 'idle' | 'loading' | 'error';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrls: ['../../shared/layout.css', './login-page.component.css'],
})
export class LoginPageComponent implements OnInit {
  state: ViewState = 'idle';
  errorMessage = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private zaloService: ZaloService,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    // Handle bfcache restore (back button from Zalo page)
    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
      if (event.persisted && this.state === 'loading') {
        this.state = 'idle';
      }
    });

    // If already registered, go to card
    const saved = this.registrationService.getSavedCustomer();
    if (saved) {
      this.router.navigate(['/card', saved.customer_code]);
      return;
    }

    // Check for Zalo error redirect
    const errorCode = this.route.snapshot.queryParamMap.get('error_code');
    if (errorCode) {
      this.errorMessage = 'Đăng nhập Zalo thất bại. Vui lòng thử lại.';
      this.state = 'error';
      return;
    }

    // Check if this is a Zalo OAuth callback (code in query params)
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.handleZaloCallback(code);
    }
  }

  loginWithZalo(): void {
    this.state = 'loading';
    this.errorMessage = '';

    this.zaloService.getLoginUrl().subscribe({
      next: (res) => {
        if (res.oauth_url) {
          window.location.href = res.oauth_url;
        } else {
          this.errorMessage = 'Không thể kết nối Zalo';
          this.state = 'error';
        }
      },
      error: () => {
        this.errorMessage = 'Lỗi kết nối server';
        this.state = 'error';
      },
    });
  }

  private handleZaloCallback(code: string): void {
    this.state = 'loading';

    this.zaloService.exchangeCode(code).subscribe({
      next: (res) => {
        this.zaloService.saveSession(res);

        if (res.phone) {
          // Phone available → auto-register
          this.autoRegister(res.zalo_user_id, res.name, res.phone);
        } else {
          // Phone missing → complete profile
          this.router.navigate(['/complete-profile']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Đăng nhập Zalo thất bại';
        this.state = 'error';
      },
    });
  }

  private autoRegister(zaloUserId: string, name: string, phone: string): void {
    this.registrationService.register(name, phone, zaloUserId).subscribe({
      next: (res) => {
        if (res.success) {
          this.registrationService.saveCustomer({
            customer_code: res.customer_code!,
            barcode_value: res.barcode_value!,
            name: res.name!,
            phone: res.phone!,
          });
          this.router.navigate(['/card', res.customer_code]);
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
    this.state = 'idle';
    this.errorMessage = '';
  }
}
