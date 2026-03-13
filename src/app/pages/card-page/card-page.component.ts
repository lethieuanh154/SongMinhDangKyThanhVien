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
  private isIOS = false;
  private barcodeRendered = false;
  private bonusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly ZALO_OA_ID = '1420769616971124037';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registrationService: RegistrationService,
  ) {}

  ngOnInit(): void {
    this.isZaloInApp = /Zalo/i.test(navigator.userAgent);
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

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
    }
  }

  private async captureCanvas(): Promise<HTMLCanvasElement> {
    const el = this.cardCapture.nativeElement;

    // Force a fixed width so html2canvas renders at a consistent size
    const originalWidth = el.style.width;
    el.style.width = '380px';

    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc: Document) => {
        // html2canvas doesn't support clamp() — apply fixed styles in the clone
        const root = clonedDoc.querySelector('.card-capture') as HTMLElement;
        if (!root) return;

        // Logo
        const logo = root.querySelector('.logo-icon') as HTMLElement;
        if (logo) { logo.style.width = '72px'; logo.style.height = '72px'; }

        const h1 = root.querySelector('.logo-section h1') as HTMLElement;
        if (h1) h1.style.fontSize = '26px';

        const subtitle = root.querySelector('.subtitle') as HTMLElement;
        if (subtitle) subtitle.style.fontSize = '14px';

        // Badge
        const badge = root.querySelector('.success-badge') as HTMLElement;
        if (badge) badge.style.fontSize = '14px';

        // Customer info
        root.querySelectorAll('.customer-info p').forEach((p) => {
          (p as HTMLElement).style.fontSize = '15px';
        });

        // Barcode container — prevent overflow clipping
        const barcodeBox = root.querySelector('.barcode-container') as HTMLElement;
        if (barcodeBox) { barcodeBox.style.overflow = 'visible'; }

        // Barcode SVG — ensure it fits
        const svg = root.querySelector('.barcode-container svg') as SVGElement;
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
        }
      },
    });

    // Restore original width
    el.style.width = originalWidth;
    return canvas;
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
      const blob = await this.canvasToBlob(canvas);

      // Try Web Share API first (works on both iOS and Android)
      if (navigator.share) {
        const file = new File([blob], `SongMinh_${this.customerCode}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          this.saveSuccess = true;
          return;
        }
      }

      // iOS fallback: open image in new tab for long-press save
      if (this.isIOS) {
        const url = URL.createObjectURL(blob);
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Giữ ảnh để lưu</title>
            <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif}
            p{color:#333;font-size:16px;margin-bottom:12px}img{max-width:95%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15)}</style></head>
            <body><p>Nhấn giữ ảnh để lưu về máy</p><img src="${url}"></body></html>`);
          w.document.close();
          this.saveSuccess = true;
          return;
        }
      }

      // Android / Desktop: download via <a> tag
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

      // Try Web Share API first (works on iOS and Android)
      if (navigator.share) {
        const file = new File([blob], `SongMinh_${this.customerCode}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          this.shareSuccess = true;
          return;
        }
      }

      // Normal browser: copy to clipboard then open Zalo OA
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        this.copySuccess = true;
      } catch {
        // Clipboard not supported - download instead
        await this.saveCardImage();
      }
    } catch {
      // Canvas capture failed - still open Zalo
    } finally {
      this.saving = false;
      // Always open Zalo OA page (for "Quan tâm")
      if (!this.shareSuccess) {
        setTimeout(() => {
          window.open(`https://zalo.me/${this.ZALO_OA_ID}`, '_blank');
        }, 500);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.bonusTimer) clearTimeout(this.bonusTimer);
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
    const isSmallScreen = window.innerWidth < 360;
    try {
      JsBarcode(this.barcodeEl.nativeElement, this.customerCode, {
        format: 'CODE128',
        width: isSmallScreen ? 1.5 : 2,
        height: isSmallScreen ? 60 : 80,
        displayValue: true,
        fontSize: isSmallScreen ? 12 : 16,
        margin: isSmallScreen ? 5 : 10,
      });
      this.barcodeRendered = true;
    } catch {
      // barcode render failed
    }
  }
}
