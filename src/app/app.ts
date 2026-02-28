import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RegistrationService } from './services/registration.service';
import { SavedCustomer } from './models/customer-response.model';
import JsBarcode from 'jsbarcode';

type ViewState = 'form' | 'loading' | 'success' | 'error';

const STORAGE_KEY = 'registered_customer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, AfterViewChecked {
  @ViewChild('barcodeEl') barcodeEl!: ElementRef<SVGElement>;

  form!: FormGroup;
  state: ViewState = 'form';
  errorMessage = '';
  savedCustomer: SavedCustomer | null = null;
  private barcodeRendered = false;

  constructor(
    private fb: FormBuilder,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^0[35789]\d{8}$/)]],
    });

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.savedCustomer = JSON.parse(saved);
        this.state = 'success';
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  ngAfterViewChecked(): void {
    if (this.state === 'success' && this.barcodeEl && !this.barcodeRendered) {
      this.renderBarcode();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state = 'loading';
    this.errorMessage = '';

    const { name, phone } = this.form.value;

    this.registrationService.register(name.trim(), phone.trim()).subscribe({
      next: (res) => {
        if (res.success) {
          this.savedCustomer = {
            customer_code: res.customer_code!,
            barcode_value: res.barcode_value!,
            name: res.name!,
            phone: res.phone!,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.savedCustomer));
          this.state = 'success';
          this.barcodeRendered = false;
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

  registerNew(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.savedCustomer = null;
    this.state = 'form';
    this.barcodeRendered = false;
    this.errorMessage = '';
    this.form.reset();
  }

  retryForm(): void {
    this.state = 'form';
    this.errorMessage = '';
  }

  private renderBarcode(): void {
    if (!this.savedCustomer || !this.barcodeEl?.nativeElement) return;
    try {
      JsBarcode(this.barcodeEl.nativeElement, this.savedCustomer.barcode_value, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });
      this.barcodeRendered = true;
    } catch {
      // barcode render failed silently
    }
  }
}
