import {PdfViewerComponent} from 'ng2-pdf-viewer';
import type {PDFDocumentProxy} from 'ng2-pdf-viewer';
import {HttpResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {AlertService} from '../services/alert.service';
import {ElementFullscreen} from './element-fullscreen';

export type PdfLoadState = 'empty' | 'loading' | 'ready' | 'error';
export type PdfViewerMode = 'ontrack' | 'browser';

@Component({
  selector: 'f-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class fPdfViewerComponent implements OnDestroy, OnChanges {
  private readonly ZOOM_MIN = 0.5;
  private readonly ZOOM_MAX = 2.5;
  private _pdfUrl: string;
  private ownsPdfBlobUrl = false;
  private loadGeneration = 0;

  @Input() pdfUrl: string;
  @Input() filename = 'PDF attachment.pdf';
  @Input() startPage = 1;

  @ViewChild(PdfViewerComponent) private pdfComponent?: PdfViewerComponent;
  @ViewChild('pdfContainer', {static: true}) private container: ElementRef<HTMLElement>;

  private readonly fullscreen = new ElementFullscreen(() => this.container?.nativeElement);
  public readonly canFullscreen = this.fullscreen.supported;
  public isFullscreen = false;

  public pdfBlobUrl: string;
  public pdfTotalPages?: number;
  public pdfHasRendered = false;
  public pageNumber = 1;
  public pdfSearchString = '';
  public zoomValue = 1;
  public loadState: PdfLoadState = 'empty';
  public errorMessage = '';
  public previewEnabled = true;
  public viewerMode: PdfViewerMode = 'ontrack';

  constructor(
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
    private alerts: AlertService,
  ) {
    this.previewEnabled = localStorage.getItem('pdfPreviewEnabled') !== 'false';
    this.viewerMode =
      localStorage.getItem('pdfViewerMode') === 'browser' ||
      localStorage.getItem('useNativePdfViewer') === 'true'
        ? 'browser'
        : 'ontrack';
    const storedZoomValue = Number.parseFloat(localStorage.getItem('pdfViewerZoom') ?? '');
    if (Number.isFinite(storedZoomValue)) {
      this.zoomValue = Math.min(Math.max(storedZoomValue, this.ZOOM_MIN), this.ZOOM_MAX);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.pdfUrl) {
      this.loadPdf(changes.pdfUrl.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.fullscreen.release();
    this.loadGeneration += 1;
    this.releaseOwnedBlob();
  }

  searchPdf(stringToSearch: string): void {
    if (!this.pdfComponent?.eventBus || this.viewerMode !== 'ontrack') {
      return;
    }
    this.pdfComponent.eventBus.dispatch('find', {
      query: stringToSearch,
      type: 'again',
      caseSensitive: false,
      findPrevious: undefined,
      highlightAll: true,
      phraseSearch: true,
    });
  }

  scrollToPage(pageNumber: number): void {
    const pagesCount = this.pdfComponent?.pdfViewer?.pagesCount ?? 0;
    if (pageNumber > 0 && pageNumber <= pagesCount) {
      this.pdfComponent.pdfViewer.scrollPageIntoView({pageNumber});
    }
  }

  public zoomIn(): void {
    if (this.zoomValue < this.ZOOM_MAX) {
      this.setZoom(this.zoomValue + 0.1);
    }
  }

  public zoomOut(): void {
    if (this.zoomValue > this.ZOOM_MIN) {
      this.setZoom(this.zoomValue - 0.1);
    }
  }

  get canZoomIn(): boolean {
    return (
      this.viewerMode === 'ontrack' && this.loadState === 'ready' && this.zoomValue < this.ZOOM_MAX
    );
  }

  get canZoomOut(): boolean {
    return (
      this.viewerMode === 'ontrack' && this.loadState === 'ready' && this.zoomValue > this.ZOOM_MIN
    );
  }

  get zoomPercent(): string {
    return `${Math.round(this.zoomValue * 100)}%`;
  }

  get displayFilename(): string {
    return this.filename?.trim() || 'PDF attachment.pdf';
  }

  get hasDownloadSource(): boolean {
    return Boolean(this.pdfBlobUrl || this._pdfUrl);
  }

  public downloadPdf(): void {
    if (this.pdfBlobUrl) {
      this.fileDownloader.downloadBlobToFileWithFeedback(this.pdfBlobUrl, this.displayFilename);
    } else if (this._pdfUrl) {
      this.fileDownloader.downloadFileWithFeedback(this._pdfUrl, this.displayFilename, {
        requestKey: `pdf-viewer:${this._pdfUrl}`,
      });
    }
  }

  /**
   * The browser's own full screen, for the task sheet or submission in this viewer.
   * Esc leaves it too, and fullscreenchange keeps the button in step either way.
   */
  public toggleFullscreen(): void {
    const entering = !this.fullscreen.active;
    this.fullscreen.toggle().catch((error: unknown) => {
      if (entering) {
        this.alerts.error(`Could not open full screen. ${error}`, 6000);
      }
    });
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = this.fullscreen.active;
    // The pages are sized to the viewer's width when the window resizes, and the
    // viewer has just changed size.
    window.dispatchEvent(new Event('resize'));
  }

  public togglePreview(): void {
    this.previewEnabled = !this.previewEnabled;
    localStorage.setItem('pdfPreviewEnabled', this.previewEnabled.toString());
    if (this.previewEnabled && this.pdfBlobUrl) {
      this.loadState = this.viewerMode === 'browser' ? 'ready' : 'loading';
    }
  }

  public toggleViewerMode(): void {
    this.viewerMode = this.viewerMode === 'ontrack' ? 'browser' : 'ontrack';
    localStorage.setItem('pdfViewerMode', this.viewerMode);
    localStorage.removeItem('useNativePdfViewer');
    if (this.pdfBlobUrl && this.previewEnabled) {
      this.loadState = this.viewerMode === 'browser' ? 'ready' : 'loading';
    }
  }

  public retry(): void {
    this.loadPdf(this._pdfUrl, true);
  }

  onLoaded(event: PDFDocumentProxy): void {
    this.pdfTotalPages = event.numPages;
    if (event.numPages < 1) {
      this.loadState = 'empty';
      return;
    }
    this.loadState = 'ready';
    this.errorMessage = '';
    window.dispatchEvent(new Event('resize'));
  }

  onPdfError(_error: unknown): void {
    this.loadState = 'error';
    this.errorMessage = `Preview could not open ${this.displayFilename}. You can retry or download the file.`;
  }

  onTextLayerRendered(): void {
    if (this.pdfHasRendered) {
      return;
    }
    this.pdfHasRendered = true;
    if (this.startPage > 1 && this.pdfTotalPages && this.startPage <= this.pdfTotalPages) {
      this.pageNumber = Number(this.startPage);
    }
  }

  private loadPdf(value: string, force = false): void {
    if (!force && this._pdfUrl === value) {
      return;
    }

    const generation = ++this.loadGeneration;
    this.releaseOwnedBlob();
    this._pdfUrl = value;
    this.pdfBlobUrl = null;
    this.pdfTotalPages = undefined;
    this.pdfHasRendered = false;
    this.pageNumber = 1;
    this.errorMessage = '';

    if (!value?.trim()) {
      this.loadState = 'empty';
      return;
    }

    this.loadState = 'loading';
    if (value.startsWith('blob:')) {
      this.pdfBlobUrl = value;
      this.ownsPdfBlobUrl = false;
      if (this.previewEnabled && this.viewerMode === 'browser') {
        this.loadState = 'ready';
      }
      return;
    }

    this.fileDownloader.downloadBlob(
      value,
      (url: string, _response: HttpResponse<Blob>) => {
        if (generation !== this.loadGeneration) {
          this.fileDownloader.releaseBlob(url);
          return;
        }
        this.pdfBlobUrl = url;
        this.ownsPdfBlobUrl = true;
        if (this.previewEnabled && this.viewerMode === 'browser') {
          this.loadState = 'ready';
        }
      },
      (_error: unknown) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        this.loadState = 'error';
        this.errorMessage = `Preview could not load ${this.displayFilename}. Check your connection and try again.`;
      },
    );
  }

  private setZoom(value: number): void {
    this.zoomValue = Math.min(Math.max(Number(value.toFixed(1)), this.ZOOM_MIN), this.ZOOM_MAX);
    localStorage.setItem('pdfViewerZoom', this.zoomValue.toString());
  }

  private releaseOwnedBlob(): void {
    if (this.pdfBlobUrl && this.ownsPdfBlobUrl) {
      this.fileDownloader.releaseBlob(this.pdfBlobUrl);
    }
    this.ownsPdfBlobUrl = false;
  }
}
