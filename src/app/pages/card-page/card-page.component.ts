import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
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
export class CardPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('barcodeEl') barcodeEl!: ElementRef<SVGElement>;
  @ViewChild('cardCapture') cardCapture!: ElementRef<HTMLDivElement>;

  state: ViewState = 'loading';
  errorMessage = '';
  customerCode = '';
  customerName = '';
  customerPhone = '';
  saving = false;
  saveSuccess = false;
  copySuccess = false;
  shareSuccess = false;
  showBonus = false;
  confettiPieces = Array.from({ length: 30 }, (_, i) => i);
  isZaloInApp = false;
  zaloSdkLoaded = false;
  private barcodeRendered = false;
  private bonusTimer: ReturnType<typeof setTimeout> | null = null;
  private zaloSdkCheckTimer: ReturnType<typeof setTimeout> | null = null;

  readonly ZALO_OA_ID = '1420769616971124037';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    this.isZaloInApp = /Zalo/i.test(navigator.userAgent);

    const code = this.route.snapshot.paramMap.get('customer_code');
    if (!code) {
      this.router.navigate(['/']);
      return;
    }

    // Check if this is a new registration (bonus overlay)
    if (history.state?.bonus) {
      this.showBonus = true;
      this.bonusTimer = setTimeout(() => this.showBonus = false, 5000);
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
      this.loadZaloSDK();
    }
  }

  private loadZaloSDK(): void {
    if (document.getElementById('zalo-sdk')) return;
    const script = document.createElement('script');
    script.id = 'zalo-sdk';
    script.src = 'https://sp.zalo.me/plugins/sdk.js';
    document.body.appendChild(script);

    // Check if SDK rendered the button after loading
    this.zaloSdkCheckTimer = setTimeout(() => {
      const btn = document.querySelector('.zalo-follow-only-button');
      // SDK replaces the div content when it loads successfully
      this.zaloSdkLoaded = !!(btn && btn.children.length > 0);
    }, 3000);
  }

  private async captureCanvas(): Promise<HTMLCanvasElement> {
    return html2canvas(this.cardCapture.nativeElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
  }

  private async canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });
  }

  async saveCardImage(): Promise<void> {
    if (!this.cardCapture?.nativeElement || this.saving) return;
    this.saving = true;
    this.saveSuccess = false;

    try {
      const canvas = await this.captureCanvas();

      // In Zalo in-app browser, try Web Share API first
      if (this.isZaloInApp && navigator.share) {
        const blob = await this.canvasToBlob(canvas);
        const file = new File([blob], `SongMinh_${this.customerCode}.png`, { type: 'image/png' });
        await navigator.share({ files: [file] });
        this.saveSuccess = true;
        return;
      }

      const link = document.createElement('a');
      link.download = `SongMinh_${this.customerCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.saveSuccess = true;
    } catch {
      // silently fail
    } finally {
      this.saving = false;
    }
  }

  async copyAndOpenZalo(): Promise<void> {
    if (!this.cardCapture?.nativeElement || this.saving) return;
    this.saving = true;
    this.saveSuccess = false;
    this.copySuccess = false;
    this.shareSuccess = false;

    try {
      const canvas = await this.captureCanvas();
      const blob = await this.canvasToBlob(canvas);

      // In Zalo in-app browser: use Web Share API (clipboard not available)
      if (this.isZaloInApp && navigator.share) {
        const file = new File([blob], `SongMinh_${this.customerCode}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          this.shareSuccess = true;
          return;
        }
      }

      // Normal browser: copy to clipboard then open Zalo
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      this.copySuccess = true;

      setTimeout(() => {
        window.open(`https://zalo.me/${this.ZALO_OA_ID}`, '_blank');
      }, 500);
    } catch {
      // Clipboard API not supported - fallback to download
      await this.saveCardImage();
      setTimeout(() => {
        window.open(`https://zalo.me/${this.ZALO_OA_ID}`, '_blank');
      }, 500);
    } finally {
      this.saving = false;
    }
  }

  ngOnDestroy(): void {
    if (this.bonusTimer) clearTimeout(this.bonusTimer);
    if (this.zaloSdkCheckTimer) clearTimeout(this.zaloSdkCheckTimer);
  }

  dismissBonus(): void {
    this.showBonus = false;
    if (this.bonusTimer) {
      clearTimeout(this.bonusTimer);
      this.bonusTimer = null;
    }
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
