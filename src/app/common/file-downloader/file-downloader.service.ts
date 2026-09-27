import {HttpClient, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {AlertService} from '../services/alert.service';

interface FileDownloaderData {
  url: string;
  response: HttpResponse<Blob>;
  success: (url: string, response: HttpResponse<Blob>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  failure: (error: any) => void;

  binaryData: Blob[];
  totalSize?: number;
}

export interface DownloadFeedbackOptions {
  /**
   * Identifies one logical download control. Starting another request with the
   * same key makes callbacks from the older request stale.
   */
  requestKey?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileDownloaderService {
  private nextFeedbackRequestId = 0;
  private readonly activeFeedbackRequests: Map<string, number> = new Map();

  constructor(
    private httpClient: HttpClient,
    private alerts: AlertService,
  ) {}

  private processPartialBlob(data: FileDownloaderData) {
    const range = data.response.headers.get('Content-Range');
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(range ?? '');
    const received = data.binaryData.reduce((size, blob) => size + blob.size, 0);
    const [start, end, totalSize] = match ? match.slice(1).map(Number) : [];

    if (
      !match ||
      ![start, end, totalSize].every(Number.isSafeInteger) ||
      start !== received ||
      end < start ||
      end >= totalSize ||
      data.response.body?.size !== end - start + 1 ||
      (data.totalSize !== undefined && data.totalSize !== totalSize)
    ) {
      data.failure?.('Unable to read data from server: invalid or out-of-order file range');
      return;
    }

    data.totalSize = totalSize;
    data.binaryData.push(data.response.body);
    if (end + 1 === totalSize) {
      this.reportSuccess(data);
      return;
    }

    this.httpClient
      .get(data.url, {
        responseType: 'blob',
        observe: 'response',
        headers: {Range: `bytes=${end + 1}-${totalSize - 1}`},
      })
      .subscribe({
        next: (response) => {
          data.response = response;
          this.processHttpResponse(data);
        },
        error: (error) => data.failure?.(error),
      });
  }

  private processHttpResponse(data: FileDownloaderData) {
    // Check if we have a partial content response
    if (data.response.status === 206) {
      this.processPartialBlob(data);
    } else {
      // A server can ignore Range and return the complete file with 200.
      // Replace previous parts rather than appending the full file to them.
      data.binaryData = [data.response.body];
      this.reportSuccess(data);
    }
  }

  private reportSuccess(data: FileDownloaderData) {
    try {
      const resourceUrl: string = window.URL.createObjectURL(
        new Blob(data.binaryData, {type: data.response.body.type}),
      );
      data.success(resourceUrl, data.response);
    } catch (error: unknown) {
      if (data.failure) {
        data.failure(error);
      }
    }
  }

  public downloadBlob(
    url: string,
    success: (url: string, response: HttpResponse<Blob>) => void,
    failure: (error) => void,
  ) {
    // Declare binary data outside of the subscription so that it can be accessed in the second requests when partial content is returned
    const binaryData = [];

    this.httpClient.get(url, {responseType: 'blob', observe: 'response'}).subscribe({
      next: (response) => {
        this.processHttpResponse({
          url: url,
          response: response,
          success: success,
          failure: failure,
          binaryData: binaryData,
        });
      },
      error: (error) => {
        if (failure) {
          failure(error);
        }
      },
    });
  }

  public releaseBlob(url: string): void {
    window.URL.revokeObjectURL(url);
  }

  /**
   * Download or save a blob to a file. This will trigger the user to "download"
   * the blob, with the suggested filename.
   *
   * @param blobUrl the url of the blob to download/save to file
   * @param filename the name of the file
   */
  public downloadBlobToFile(blobUrl: string, filename: string): void {
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.target = '_blank';
    downloadLink.setAttribute('download', filename);
    document.body.appendChild(downloadLink);

    downloadLink.click();
    downloadLink.parentNode.removeChild(downloadLink);
  }

  /**
   * Dispatch an already-created blob URL to the browser and report only what
   * browser code can prove: that the download was started. The caller retains
   * ownership of blobUrl and remains responsible for revoking it.
   */
  public downloadBlobToFileWithFeedback(blobUrl: string, filename: string): void {
    const safeFilename = this.safeFilename(filename, 'download');
    this.dispatchDownloadWithFeedback(blobUrl, safeFilename, false);
  }

  /**
   * Retrieve a file, dispatch it to the browser, and provide accessible start
   * or failure feedback. A newer request for the same logical control wins, so
   * a delayed response cannot trigger a duplicate download or stale message.
   */
  public downloadFileWithFeedback(
    url: string,
    defaultFilename: string,
    options: DownloadFeedbackOptions = {},
  ): void {
    const safeDefaultFilename = this.safeFilename(defaultFilename, 'download');
    const requestKey = options.requestKey ?? `${url}\u0000${safeDefaultFilename}`;
    const requestId = ++this.nextFeedbackRequestId;
    this.activeFeedbackRequests.set(requestKey, requestId);

    this.downloadBlob(
      url,
      (resourceUrl: string, response: HttpResponse<Blob>) => {
        if (!this.isCurrentFeedbackRequest(requestKey, requestId)) {
          this.releaseBlob(resourceUrl);
          return;
        }

        const filename = this.filenameFromResponse(response, safeDefaultFilename);
        this.finishFeedbackRequest(requestKey, requestId);
        this.dispatchDownloadWithFeedback(resourceUrl, filename, true);
      },
      (_error: unknown) => {
        if (!this.isCurrentFeedbackRequest(requestKey, requestId)) {
          return;
        }

        this.finishFeedbackRequest(requestKey, requestId);
        this.alerts.error(`Download failed: ${safeDefaultFilename}. Please try again.`);
      },
    );
  }

  public downloadFile(url: string, defaultFilename: string) {
    this.downloadBlob(
      url,
      (resourceUrl: string, response: HttpResponse<Blob>) => {
        const filename = this.filenameFromResponse(response, defaultFilename);
        try {
          this.downloadBlobToFile(resourceUrl, filename);
        } finally {
          this.releaseBlobAfterDispatch(resourceUrl);
        }
      },
      (error) => {
        this.alerts.error(`Error downloading file - ${error}`);
      },
    );
  }

  private filenameFromResponse(response: HttpResponse<Blob>, defaultFilename: string): string {
    const fallback = this.safeFilename(defaultFilename, 'download');
    const contentDisposition = response.headers.get('Content-Disposition');
    if (!contentDisposition) {
      return fallback;
    }

    const encodedFilename = this.contentDispositionParameter(contentDisposition, 'filename*');
    const decodedFilename = encodedFilename
      ? this.decodeExtendedFilename(encodedFilename)
      : undefined;
    if (decodedFilename) {
      return this.safeFilename(decodedFilename, fallback);
    }

    const filename = this.contentDispositionParameter(contentDisposition, 'filename');
    return this.safeFilename(filename, fallback);
  }

  private contentDispositionParameter(header: string, parameter: string): string | undefined {
    const escapedParameter = parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(
      `(?:^|;)\\s*${escapedParameter}\\s*=\\s*(?:"((?:\\\\.|[^"])*)"|([^;]*))`,
      'i',
    );
    const match = expression.exec(header);
    const value = match?.[1] ?? match?.[2];
    if (!value) {
      return undefined;
    }

    return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  }

  private decodeExtendedFilename(value: string): string | undefined {
    const encodedValueMatch = /^([^']*)'[^']*'(.*)$/.exec(value);
    const charset = encodedValueMatch?.[1]?.toLowerCase();
    const encodedValue = encodedValueMatch?.[2] ?? value;
    if (charset && charset !== 'utf-8' && charset !== 'utf8') {
      return undefined;
    }

    try {
      return decodeURIComponent(encodedValue);
    } catch (_error: unknown) {
      return undefined;
    }
  }

  private safeFilename(filename: string | undefined, fallback: string): string {
    const sanitize = (candidate: string | undefined): string | undefined => {
      if (!candidate) {
        return undefined;
      }

      const withoutControls = Array.from(candidate)
        .filter((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return !(
            codePoint <= 0x1f ||
            (codePoint >= 0x7f && codePoint <= 0x9f) ||
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2066 && codePoint <= 0x2069)
          );
        })
        .join('')
        .trim();
      const finalPathSegment = withoutControls.split(/[\\/]/).filter(Boolean).pop()?.trim();
      if (!finalPathSegment || finalPathSegment === '.' || finalPathSegment === '..') {
        return undefined;
      }

      return Array.from(finalPathSegment).slice(0, 255).join('');
    };

    return sanitize(filename) ?? sanitize(fallback) ?? 'download';
  }

  private isCurrentFeedbackRequest(requestKey: string, requestId: number): boolean {
    return this.activeFeedbackRequests.get(requestKey) === requestId;
  }

  private finishFeedbackRequest(requestKey: string, requestId: number): void {
    if (this.isCurrentFeedbackRequest(requestKey, requestId)) {
      this.activeFeedbackRequests.delete(requestKey);
    }
  }

  private releaseBlobAfterDispatch(resourceUrl: string): void {
    window.setTimeout(() => this.releaseBlob(resourceUrl), 0);
  }

  /**
   * The one semantic download-feedback dispatch path. Public convenience
   * methods differ only in how they obtain and own the blob URL.
   */
  private dispatchDownloadWithFeedback(
    blobUrl: string,
    filename: string,
    releaseAfterDispatch: boolean,
  ): void {
    try {
      this.downloadBlobToFile(blobUrl, filename);
      this.alerts.message(`Download started: ${filename}`);
    } catch (_error: unknown) {
      this.alerts.error(`Download failed: ${filename}. Please try again.`);
    } finally {
      if (releaseAfterDispatch) {
        this.releaseBlobAfterDispatch(blobUrl);
      }
    }
  }
}
