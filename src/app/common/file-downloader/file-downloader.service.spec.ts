import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AlertService} from '../services/alert.service';
import {FileDownloaderService} from './file-downloader.service';

describe('FileDownloaderService download feedback', () => {
  let service: FileDownloaderService;
  let httpMock: HttpTestingController;
  let alerts: {
    message: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let clickedFilenames: string[];
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    clickedFilenames = [];
    alerts = {message: vi.fn(), error: vi.fn()};
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    createObjectURL = vi.fn(() => 'blob:download');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: createObjectURL});
    Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: revokeObjectURL});

    TestBed.configureTestingModule({
      providers: [
        FileDownloaderService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: AlertService, useValue: alerts},
      ],
    });

    service = TestBed.inject(FileDownloaderService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clickedFilenames.push(this.download);
    });
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('announces start only after dispatch, prefers filename*, and revokes its object URL', () => {
    service.downloadFileWithFeedback('/feedback/42', 'fallback.pdf');

    expect(alerts.message).not.toHaveBeenCalled();
    expect(clickedFilenames).toEqual([]);

    httpMock.expectOne('/feedback/42').flush(new Blob(['pdf'], {type: 'application/pdf'}), {
      headers: new HttpHeaders({
        'Content-Disposition':
          "attachment; filename=legacy.pdf; filename*=UTF-8''..%2Fprivate%2F%E2%9C%93%20review.pdf",
      }),
    });

    expect(clickedFilenames).toEqual(['✓ review.pdf']);
    expect(alerts.message).toHaveBeenCalledOnce();
    expect(alerts.message).toHaveBeenCalledWith('Download started: ✓ review.pdf');
    expect(alerts.error).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('falls back to a safely bounded plain filename when filename* is malformed', () => {
    service.downloadFileWithFeedback('/feedback/43', 'fallback.pdf');

    httpMock.expectOne('/feedback/43').flush(new Blob(['docx']), {
      headers: new HttpHeaders({
        'Content-Disposition':
          "attachment; filename=..\\safe\\Feedback <draft>.docx; filename*=UTF-8''%E0%A4%A",
      }),
    });

    expect(clickedFilenames).toEqual(['Feedback <draft>.docx']);
    expect(alerts.message).toHaveBeenCalledWith('Download started: Feedback <draft>.docx');
  });

  it('reports a retrieval failure without claiming that a download started or exposing the error', () => {
    service.downloadFileWithFeedback('/feedback/44', '../Student feedback.docx');

    httpMock.expectOne('/feedback/44').flush(new Blob(['private server detail']), {
      status: 503,
      statusText: 'Unavailable',
    });

    expect(clickedFilenames).toEqual([]);
    expect(alerts.message).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledOnce();
    expect(alerts.error).toHaveBeenCalledWith(
      'Download failed: Student feedback.docx. Please try again.',
    );
  });

  it('ignores a stale response when a newer request uses the same control key', () => {
    service.downloadFileWithFeedback('/feedback/old', 'feedback.pdf', {requestKey: 'comment-7'});
    service.downloadFileWithFeedback('/feedback/new', 'feedback.pdf', {requestKey: 'comment-7'});

    httpMock.expectOne('/feedback/old').flush(new Blob(['old']));

    expect(clickedFilenames).toEqual([]);
    expect(alerts.message).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');

    httpMock.expectOne('/feedback/new').flush(new Blob(['new']));

    expect(clickedFilenames).toEqual(['feedback.pdf']);
    expect(alerts.message).toHaveBeenCalledOnce();
    expect(alerts.error).not.toHaveBeenCalled();
  });

  it('reports dispatch failure and still revokes an internally-created object URL', () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      throw new Error('browser rejected click');
    });

    service.downloadFileWithFeedback('/feedback/45', 'feedback.pdf');
    httpMock.expectOne('/feedback/45').flush(new Blob(['pdf']));

    expect(alerts.message).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith('Download failed: feedback.pdf. Please try again.');

    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('reports failure when the browser cannot create a downloadable object URL', () => {
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('object URLs unavailable');
    });

    service.downloadFileWithFeedback('/feedback/46', 'feedback.pdf');
    httpMock.expectOne('/feedback/46').flush(new Blob(['pdf']));

    expect(clickedFilenames).toEqual([]);
    expect(alerts.message).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith('Download failed: feedback.pdf. Please try again.');
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('reports dispatch of a caller-owned blob without revoking the preview URL', () => {
    service.downloadBlobToFileWithFeedback('blob:preview', '../displayed-pdf.pdf');

    expect(clickedFilenames).toEqual(['displayed-pdf.pdf']);
    expect(alerts.message).toHaveBeenCalledWith('Download started: displayed-pdf.pdf');
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the legacy URL-download API toast-free while releasing its temporary blob', () => {
    service.downloadFile('/legacy/export', 'export.csv');
    httpMock.expectOne('/legacy/export').flush(new Blob(['row']));

    expect(clickedFilenames).toEqual(['export.csv']);
    expect(alerts.message).not.toHaveBeenCalled();
    expect(alerts.error).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });
});

describe('FileDownloaderService', () => {
  const endpoint = '/api/projects/12/tasks/34/submission';
  let service: FileDownloaderService;
  let http: HttpTestingController;
  const success = vi.fn();
  const failure = vi.fn();
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:download');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL;
      },
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: AlertService, useValue: {error: vi.fn()}},
      ],
    });
    service = TestBed.inject(FileDownloaderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function part(range: string | null, text: string) {
    http.expectOne(endpoint).flush(new Blob([text], {type: 'application/pdf'}), {
      status: 206,
      statusText: 'Partial Content',
      headers: range ? {'Content-Range': range} : {},
    });
  }

  function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  }

  it('downloads a complete file without requesting another part', async () => {
    service.downloadBlob(endpoint, success, failure);
    const request = http.expectOne(endpoint);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.has('Range')).toBe(false);
    request.flush(new Blob(['complete'], {type: 'application/pdf'}));

    expect(success).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await readBlob(blob)).toBe('complete');
    expect(blob.type).toBe('application/pdf');
    expect(failure).not.toHaveBeenCalled();
  });

  it('joins consecutive ranges and requests only remaining byte indexes', async () => {
    service.downloadBlob(endpoint, success, failure);
    part('bytes 0-2/6', 'abc');
    expect(success).not.toHaveBeenCalled();
    const next = http.expectOne(endpoint);
    expect(next.request.headers.get('Range')).toBe('bytes=3-5');
    next.flush(new Blob(['def'], {type: 'application/pdf'}), {
      status: 206,
      statusText: 'Partial Content',
      headers: {'Content-Range': 'bytes 3-5/6'},
    });

    expect(success).toHaveBeenCalledOnce();
    expect(await readBlob(createObjectURL.mock.calls[0][0])).toBe('abcdef');
    expect(failure).not.toHaveBeenCalled();
  });

  it('accepts case-insensitive byte range units', async () => {
    service.downloadBlob(endpoint, success, failure);
    part('Bytes 0-2/3', 'abc');

    expect(success).toHaveBeenCalledOnce();
    expect(await readBlob(createObjectURL.mock.calls[0][0])).toBe('abc');
    expect(failure).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'abc'],
    ['garbage', 'abc'],
    ['bytes 0-x/6', 'abc'],
    ['bytes 0-2/*', 'abc'],
    ['bytes 1-3/6', 'abc'],
    ['bytes 0-6/6', 'abcdefg'],
    ['bytes 0-2/6', 'ab'],
    ['bytes 0-9007199254740992/9007199254740993', 'abc'],
  ])('fails once for invalid Content-Range %s without publishing a partial file', (range, body) => {
    service.downloadBlob(endpoint, success, failure);
    part(range, body);

    expect(failure).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    http.expectNone(endpoint);
  });

  it.each(['bytes 0-2/6', 'bytes 4-5/6', 'bytes 3-5/7'])(
    'rejects a duplicate, skipped, or changed-size continuation %s',
    (range) => {
      service.downloadBlob(endpoint, success, failure);
      part('bytes 0-2/6', 'abc');
      part(range, range === 'bytes 4-5/6' ? 'ef' : 'def');

      expect(failure).toHaveBeenCalledOnce();
      expect(success).not.toHaveBeenCalled();
      expect(createObjectURL).not.toHaveBeenCalled();
      http.expectNone(endpoint);
    },
  );

  it('uses the complete response when the server ignores a continuation Range', async () => {
    service.downloadBlob(endpoint, success, failure);
    part('bytes 0-2/6', 'abc');
    http.expectOne(endpoint).flush(new Blob(['abcdef']));

    expect(await readBlob(createObjectURL.mock.calls[0][0])).toBe('abcdef');
    expect(success).toHaveBeenCalledOnce();
    expect(failure).not.toHaveBeenCalled();
  });

  it('reports a failed continuation without offering a truncated download', () => {
    service.downloadBlob(endpoint, success, failure);
    part('bytes 0-2/6', 'abc');
    http.expectOne(endpoint).flush(null, {status: 500, statusText: 'Server Error'});

    expect(failure).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(success).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
