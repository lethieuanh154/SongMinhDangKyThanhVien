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
  previewImageUrl: string | null = null;
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
    this.previewImageUrl = null;

    try {
      const canvas = await this.captureCanvas();

      // iOS / Zalo in-app: show image inline for long-press save
      // (navigator.share shows iOS share sheet, window.open blocked in Zalo)
      if (this.isIOS || this.isZaloInApp) {
        this.previewImageUrl = canvas.toDataURL('image/png');
        this.saveSuccess = true;
        return;
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
    if (this.saving) return;
    this.copySuccess = false;

    const zaloUrl = `https://zalo.me/${this.ZALO_OA_ID}`;

    // Zalo in-app: navigate directly (already inside Zalo)
    if (this.isZaloInApp) {
      window.location.href = zaloUrl;
      return;
    }

    // Open Zalo OA immediately (synchronous, before any await, so popup won't be blocked)
    window.open(zaloUrl, '_blank');

    // Try to copy image to clipboard in background
    if (this.cardCapture?.nativeElement) {
      this.saving = true;
      try {
        const canvas = await this.captureCanvas();
        const blob = await this.canvasToBlob(canvas);
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        this.copySuccess = true;
      } catch {
        // Clipboard copy failed - Zalo is already open, that's OK
      } finally {
        this.saving = false;
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
