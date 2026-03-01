import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RegistrationService } from '../../services/registration.service';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';

type ViewState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-card-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './card-page.component.html',
  styleUrls: ['../../shared/layout.css', './card-page.component.css'],
})
export class CardPageComponent implements OnInit, AfterViewChecked {
  @ViewChild('barcodeEl') barcodeEl!: ElementRef<SVGElement>;
  @ViewChild('cardCapture') cardCapture!: ElementRef<HTMLDivElement>;

  state: ViewState = 'loading';
  errorMessage = '';
  customerCode = '';
  customerName = '';
  customerPhone = '';
  saving = false;
  saveSuccess = false;
  private barcodeRendered = false;

  private readonly ZALO_OA_ID = '1420769616971124037';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('customer_code');
    if (!code) {
      this.router.navigate(['/']);
      return;
    }

    // Try localStorage first
    const saved = this.registrationService.getSavedCustomer();
    if (saved && saved.customer_code === code) {
      this.customerCode = saved.customer_code;
      this.customerName = saved.name;
      this.customerPhone = saved.phone;
      this.state = 'ready';
      return;
    }

    // Fetch from API
    this.registrationService.getCard(code).subscribe({
      next: (res) => {
        if (res.success) {
          this.customerCode = res.customer_code!;
          this.customerName = res.name!;
          this.customerPhone = res.phone!;
          this.state = 'ready';
        } else {
          this.errorMessage = res.message || 'Không tìm thấy khách hàng';
          this.state = 'error';
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Lỗi kết nối server';
        this.state = 'error';
      },
    });
  }

  ngAfterViewChecked(): void {
    if (this.state === 'ready' && this.barcodeEl && !this.barcodeRendered) {
      this.renderBarcode();
    }
  }

  async saveCardImage(): Promise<void> {
    if (!this.cardCapture?.nativeElement || this.saving) return;
    this.saving = true;
    this.saveSuccess = false;

    try {
      const canvas = await html2canvas(this.cardCapture.nativeElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `SongMinh_${this.customerCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.saveSuccess = true;
    } catch {
      // fallback: try share API
    } finally {
      this.saving = false;
    }
  }

  async saveAndOpenZalo(): Promise<void> {
    await this.saveCardImage();
    // Small delay so user sees the download, then open Zalo OA chat
    setTimeout(() => {
      window.open(`https://zalo.me/${this.ZALO_OA_ID}`, '_blank');
    }, 500);
  }

  registerNew(): void {
    this.registrationService.clearSavedCustomer();
    this.router.navigate(['/']);
  }

  private renderBarcode(): void {
    if (!this.customerCode || !this.barcodeEl?.nativeElement) return;
    try {
      JsBarcode(this.barcodeEl.nativeElement, this.customerCode, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });
      this.barcodeRendered = true;
    } catch {
      // barcode render failed
    }
  }
}
