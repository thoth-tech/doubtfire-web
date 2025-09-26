import { Injectable, Component, Inject, HostListener } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

/* ============================================================================
   Normalisation helpers
============================================================================ */

type RowLike = unknown;
type RowObject = Record<string, unknown>;

/** Canonical task-definition columns in required order (API / CSV spec). */
const CANON_KEYS = [
  'name',
  'abbreviation',
  'description',
  'weighting',
  'target_grade',
  'restrict_status_updates',
  'max_quality_pts',
  'is_graded',
  'plagiarism_warn_pct',
  'group_set',
  'upload_requirements',
  'start_week',
  'start_day',
  'target_week',
  'target_day',
  'due_week',
  'due_day',
  'tutorial_stream',
] as const;
export type CanonKey = (typeof CANON_KEYS)[number];

/** Labels for headers */
const PRETTY_LABEL: Record<string, string> = Object.fromEntries(
  (CANON_KEYS as readonly string[]).map(k => [
    k,
    k.split('_').map(s => (s ? s[0].toUpperCase() + s.slice(1) : s)).join(' '),
  ]),
);
// also for ZIP
PRETTY_LABEL['data'] = 'Data';

/** Compactly stringify any non-scalar values. */
function compact(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try { return JSON.stringify(value); } catch { return String(value); }
}

/** Try to parse a JSON string safely. */
function tryParseJSON(s: string): unknown | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}

/** If value is an array of [key,value] pairs, turn into object. */
function pairsToObject(arr: unknown): RowObject | undefined {
  if (Array.isArray(arr) && arr.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string')) {
    return Object.fromEntries(arr as [string, unknown][]);
  }
  return undefined;
}

/** Regex fallback for strings like: ["name","Task"], ["abbreviation","1.1P"], ... (no outer [ ... ]) */
function loosePairsToObject(s: string): RowObject | undefined {
  const re = /\[\s*"([^"]+)"\s*,\s*"((?:\\"|[^"])*)"\s*\]/g;
  let m: RegExpExecArray | null;
  const out: RowObject = {};
  let found = false;
  while ((m = re.exec(s)) !== null) {
    out[m[1]] = m[2].replace(/\\"/g, '"');
    found = true;
  }
  return found ? out : undefined;
}

/** Convert CSVish row → object, or null if nothing usable. */
function parseRowToObject(row: RowLike): RowObject | null {
  if (row == null) return null;
  if (typeof row === 'object' && !Array.isArray(row)) return row as RowObject;

  const fromPairs = pairsToObject(row);
  if (fromPairs) return fromPairs;

  if (typeof row === 'string') {
    const s = row.trim();
    const j1 = tryParseJSON(s);
    if (j1) {
      const p = pairsToObject(j1);
      if (p) return p;
      if (typeof j1 === 'object' && !Array.isArray(j1)) return j1 as RowObject;
    }
    if (s.includes('["')) {
      const wrapped = `[${s.replace(/,\s*$/, '')}]`;
      const j2 = tryParseJSON(wrapped);
      const p2 = pairsToObject(j2);
      if (p2) return p2;
    }
    const loose = loosePairsToObject(s);
    if (loose) return loose;
  }
  return null;
}

/** Compute displayed keys: canonical first (if present), extras alphabetically. */
function computeDisplayedKeys(rows: RowObject[]): string[] {
  const present = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => present.add(k)));
  const canon = CANON_KEYS.filter(k => present.has(k));
  const extra = Array.from(present).filter(k => !(canon as readonly string[]).includes(k)).sort();
  return [...canon, ...extra];
}

/* ============================================================================
   Shared types
============================================================================ */

export type TabKey = 'success' | 'errors' | 'ignored';

export interface CsvResponseItem {
  message: string;
  row?: RowLike;          // CSV path
  data?: unknown;         // ZIP path (sometimes a string)
}

export interface CsvResultResponse {
  success: CsvResponseItem[];
  errors: CsvResponseItem[];
  ignored: CsvResponseItem[];
}

export interface CsvResultModalData {
  title: string;
  response: CsvResultResponse;
}

export interface CsvUploadModalData {
  title: string;
  message?: string;
  url: string;
  accept?: string;
  onSuccess?: (payload: unknown) => void; // legacy hook
}

/* ============================================================================
   Dialog launcher
============================================================================ */
@Injectable({ providedIn: 'root' })
export class CsvDialogsService {
  constructor(private dialog: MatDialog) {}
  private resultRef?: MatDialogRef<CsvResultModalComponent>;

  openResult(data: CsvResultModalData) {
    if (this.resultRef) { this.resultRef.close(); this.resultRef = undefined; }
    this.resultRef = this.dialog.open(CsvResultModalComponent, {
      width: '960px',
      data,
      autoFocus: false,
      restoreFocus: false,
    });
    this.resultRef.afterClosed().subscribe(() => (this.resultRef = undefined));
    return this.resultRef;
  }

  openUpload(data: CsvUploadModalData) {
    return this.dialog.open(CsvUploadModalComponent, {
      width: '720px',
      data,
      autoFocus: false,
      restoreFocus: false,
    });
  }
}

/* ============================================================================
   RESULT MODAL
============================================================================ */

@Component({
  selector: 'f-csv-result-modal',
  templateUrl: './csv-result-modal.component.html',
  styleUrls: ['./csv-modals.component.scss'],
})
export class CsvResultModalComponent {
  title = '';
  activeTab: TabKey = 'success';

  /** ZIP vs CSV mode (affects the columns). */
  isZip = false;

  // table
  displayedKeys: string[] = [];                 // 'data' for ZIP, canonical set for CSV
  pretty: Record<string, string> = PRETTY_LABEL;

  // data buckets ready to display
  private buckets: Record<TabKey, { message: string; values: Record<string, string> }[]> = {
    success: [],
    errors: [],
    ignored: [],
  };

  // pager
  pageSize = 5;
  currentPage = 1;
  totalPages = 1;

  constructor(
    private ref: MatDialogRef<CsvResultModalComponent>,
    @Inject(MAT_DIALOG_DATA) data: CsvResultModalData,
  ) {
    this.title = data.title;

    // Decide ZIP vs CSV: by title OR by row shape (string-like)
    const any = [...(data.response.success || []), ...(data.response.errors || []), ...(data.response.ignored || [])];
    const looksLikeZip =
      /zip|sheet|resource/i.test(this.title) ||
      any.some(it => typeof it.data === 'string') ||
      any.every(it => typeof (it as any).row === 'string');

    this.isZip = !!looksLikeZip;

    // Normalise
    const normalised: Record<TabKey, { message: string; values: RowObject }[]> = {
      success: (data.response.success || []).map(i => ({ message: i.message, values: this.zipify(i) })),
      errors:  (data.response.errors  || []).map(i => ({ message: i.message, values: this.zipify(i) })),
      ignored: (data.response.ignored || []).map(i => ({ message: i.message, values: this.zipify(i) })),
    };

    // choose initial tab
    if (normalised.errors.length) this.activeTab = 'errors';
    else if (normalised.success.length) this.activeTab = 'success';
    else this.activeTab = 'ignored';

    // columns
    this.displayedKeys = this.isZip
      ? ['data']
      : computeDisplayedKeys(normalised[this.activeTab].map(x => x.values));

    // convert values → strings for display
    (['success', 'errors', 'ignored'] as TabKey[]).forEach(tab => {
      this.buckets[tab] = normalised[tab].map(it => ({
        message: it.message,
        values: Object.fromEntries(
          this.displayedKeys.map(k => [k, compact((it.values as RowObject)[k])]),
        ) as Record<string, string>,
      }));
    });

    this.recalcPager();
  }

  /** Turn any API item into a display object depending on mode. */
  private zipify(it: CsvResponseItem): RowObject {
    if (!this.isZip) return parseRowToObject(it.row as RowLike) || {};
    // ZIP: make best-effort to extract a filename/string
    const cand: any = (it as any).data ?? (it as any).row ?? '';
    if (typeof cand === 'string') return { data: cand };
    if (cand && typeof cand === 'object') {
      const guess = cand.filename || cand.file || cand.name || cand.path || cand.url || '';
      return { data: guess ? String(guess) : JSON.stringify(cand) };
    }
    return { data: '' };
  }

  /* ---- Stop bubbling that re-opens a second dialog ---- */
  @HostListener('click', ['$event'])    onHostClick(e: MouseEvent)    { e.stopPropagation(); }
  @HostListener('mousedown', ['$event'])onHostDown(e: MouseEvent)     { e.stopPropagation(); }
  @HostListener('pointerdown', ['$event']) onHostPtr(e: PointerEvent) { e.stopPropagation(); }

  /* ---- table helpers ---- */
  count(tab: TabKey): number { return this.buckets[tab]?.length || 0; }

  setTab(tab: TabKey): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    // adjust columns for CSV only; ZIP is fixed 'data'
    if (!this.isZip) {
      const keys = computeDisplayedKeys(this.buckets[this.activeTab].map(x => x.values as RowObject));
      this.displayedKeys = keys;
      const list = this.buckets[this.activeTab];
      this.buckets[this.activeTab] = list.map(it => ({
        message: it.message,
        values: Object.fromEntries(this.displayedKeys.map(k => [k, compact((it.values as RowObject)[k])])) as Record<string, string>,
      }));
    }

    this.currentPage = 1;
    this.recalcPager();
  }

  pageRows(): { message: string; values: Record<string, string> }[] {
    const all = this.buckets[this.activeTab] || [];
    const start = (this.currentPage - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  /* ---- pager ---- */
  private recalcPager(): void {
    const total = this.count(this.activeTab);
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
  }

  pageNumbers(): (number | '…')[] {
    const pages: (number | '…')[] = [];
    const total = this.totalPages;
    if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); return pages; }
    const cur = this.currentPage;
    pages.push(1);
    const add = (n: number | '…') => pages.push(n);
    if (cur > 3) add('…');
    for (let n = Math.max(2, cur - 1); n <= Math.min(total - 1, cur + 1); n++) add(n);
    if (cur < total - 2) add('…');
    add(total);
    return pages;
  }

  goFirst(): void { if (this.currentPage > 1) this.currentPage = 1; }
  goPrev(): void  { if (this.currentPage > 1) this.currentPage--; }
  goNext(): void  { if (this.currentPage < this.totalPages) this.currentPage++; }
  goLast(): void  { if (this.currentPage < this.totalPages) this.currentPage = this.totalPages; }
  goTo(p: number | '…'): void {
    if (p === '…') return;
    const n = Number(p);
    if (!Number.isFinite(n)) return;
    this.currentPage = Math.min(Math.max(1, n), this.totalPages);
  }

  close(): void { this.ref.close(); }
}

/* ============================================================================
   UPLOAD MODAL (unchanged CSV behaviour; wording/icon auto-switch)
============================================================================ */

type UploadStage = 'ready' | 'uploading';

@Component({
  selector: 'f-csv-upload-modal',
  templateUrl: './csv-upload-modal.component.html',
  styleUrls: ['./csv-modals.component.scss'],
})
export class CsvUploadModalComponent {
  stage: UploadStage = 'ready';
  file: File | null = null;
  errorText = '';
  progress = 0;

  /** Infer intent from the dialog title (CSV vs ZIP). */
  get isZip(): boolean { return /zip|sheet|resource/i.test(this.data.title); }
  get fileKind(): 'CSV' | 'ZIP' { return this.isZip ? 'ZIP' : 'CSV'; }

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private ref: MatDialogRef<CsvUploadModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CsvUploadModalData,
  ) {}

  // --- dropzone / pick ---
  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files && input.files.length ? input.files[0] : null;
    this.errorText = '';
  }
  onDragOver(e: DragEvent): void { e.preventDefault(); }
  onFileDrop(e: DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) { this.file = f; this.errorText = ''; }
  }
  clearFile(): void { this.file = null; this.errorText = ''; }

  startUpload(): void {
    if (!this.file) { this.errorText = `Please choose a ${this.fileKind} file.`; return; }
    this.stage = 'uploading';
    this.progress = 10;

    const form = new FormData();
    form.append('file', this.file);

    this.http.post(this.data.url, form).subscribe({
      next: (payload: unknown) => {
        // give legacy callers a chance to handle results themselves
        let handledByCaller = false;
        try { this.data.onSuccess?.(payload); handledByCaller = !!this.data.onSuccess; } catch { /* ignore */ }

        this.ref.close();

        // if caller didn't handle, open our results
        if (!handledByCaller) {
          const p: any = payload as any;
          if (p && (p.success || p.errors || p.ignored)) {
            const modalData: CsvResultModalData = {
              title: this.data.title.replace(/^Upload/i, 'Import Results'),
              response: {
                success: p.success ?? [],
                errors:  p.errors ?? [],
                ignored: p.ignored ?? [],
              },
            };
            this.dialog.open(CsvResultModalComponent, {
              width: '960px',
              data: modalData,
              autoFocus: false,
              restoreFocus: false,
            });
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.stage = 'ready';
        this.errorText = err.message || 'Upload failed.';
      },
      complete: () => { this.progress = 100; },
    });
  }

  close(): void { this.ref.close(); }
}
