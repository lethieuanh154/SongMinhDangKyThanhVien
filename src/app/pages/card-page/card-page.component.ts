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
  hintMessage = '';
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

    // Pre-convert logo to data URL and swap on the ORIGINAL element
    // (setting in onclone is too late — useCORS re-fetches with crossOrigin header
    //  which fails if the server doesn't return CORS headers for static assets)
    const originalLogo = el.querySelector('.logo-icon') as HTMLImageElement;
    let originalLogoSrc = '';
    if (originalLogo?.complete && originalLogo.naturalWidth > 0) {
      try {
        const c = document.createElement('canvas');
        c.width = originalLogo.naturalWidth;
        c.height = originalLogo.naturalHeight;
        c.getContext('2d')!.drawImage(originalLogo, 0, 0);
        originalLogoSrc = originalLogo.src;
        originalLogo.src = c.toDataURL('image/png');
      } catch { /* keep original src */ }
    }

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

        const logo = root.querySelector('.logo-icon') as HTMLElement;
        if (logo) { logo.style.width = '72px'; logo.style.height = '72px'; }

        const h1 = root.querySelector('.logo-section h1') as HTMLElement;
        if (h1) h1.style.fontSize = '26px';

        const subtitle = root.querySelector('.subtitle') as HTMLElement;
        if (subtitle) subtitle.style.fontSize = '14px';

        const badge = root.querySelector('.success-badge') as HTMLElement;
        if (badge) { badge.style.fontSize = '14px'; badge.style.whiteSpace = 'nowrap'; }

        root.querySelectorAll('.customer-info p').forEach((p) => {
          (p as HTMLElement).style.fontSize = '15px';
        });

        const barcodeBox = root.querySelector('.barcode-container') as HTMLElement;
        if (barcodeBox) {
          barcodeBox.style.overflow = 'visible';
          barcodeBox.style.textAlign = 'center';
        }

        const svg = root.querySelector('.barcode-container svg') as SVGElement;
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          svg.style.display = 'block';
          svg.style.margin = '0 auto';
        }
      },
    });

    // Restore originals
    el.style.width = originalWidth;
    if (originalLogoSrc) originalLogo.src = originalLogoSrc;
    return canvas;
  }

  private async canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });
  }

  async saveCardImage(): Promise<void> {
    if (!this.cardCapture?.nativeElement || this.saving) return;
    this.hintMessage = '';

    // iOS Zalo: no save/download/clipboard API works — guide user to Safari
    if (this.isZaloInApp && this.isIOS) {
      this.hintMessage = 'Nhấn ⋯ (góc phải) → Mở trình duyệt → Lưu ảnh';
      return;
    }

    this.saving = true;

    try {
      const canvas = await this.captureCanvas();
      const blob = await this.canvasToBlob(canvas);

      if (this.isZaloInApp) {
        // Android Zalo: try share API first
        try {
          const file = new File([blob], `SongMinh_${this.customerCode}.png`, { type: 'image/png' });
          await navigator.share({ files: [file] });
          this.hintMessage = 'Ảnh đã lưu!';
          return;
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
        }

        // Android Zalo fallback: download via data URL
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `SongMinh_${this.customerCode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.hintMessage = 'Ảnh đã lưu!';
        return;
      }

      // Safari / Android / Desktop: download via <a> tag
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `SongMinh_${this.customerCode}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.hintMessage = this.isIOS
        ? 'Ảnh đã tải! Mở ảnh → Sao chép → Dán vào chat Zalo'
        : 'Ảnh đã lưu!';
    } catch {
      // silently fail
    } finally {
      this.saving = false;
    }
  }

  async copyAndOpenZalo(): Promise<void> {
    if (this.saving) return;
    this.hintMessage = '';

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
        this.hintMessage = 'Ảnh đã copy! Hãy paste (dán) ảnh vào chat Zalo.';
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
