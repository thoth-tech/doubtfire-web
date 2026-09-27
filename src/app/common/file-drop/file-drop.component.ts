import {HttpClient, HttpErrorResponse, HttpEventType, HttpResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {Subscription, throwError} from 'rxjs';
import {AlertService} from '../services/alert.service';

/**
 * Allow files to be dropped for upload
 */
@Component({
  selector: 'f-file-drop',
  templateUrl: 'file-drop.component.html',
  styleUrls: ['file-drop.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FileDropComponent {
  @Input({required: true}) mode: 'endpoint' | 'event';

  /** The name of the file(s) you are asking the user to upload */
  @Input() desiredFileName: string;

  /** Is this a multi-file uploader? */
  @Input() multiple: boolean = false;

  /** The file types that are allowed to be uploaded */
  @Input() accept: string;

  /** The URL of the endpoint to POST the file to if mode is endpoint*/
  @Input() endpoint: string;
  @Input() body: object;
  @Output() fileChange: EventEmitter<File> = new EventEmitter();
  @Output() uploadSuccess: EventEmitter<HttpResponse<object>> = new EventEmitter();

  protected uploadProgress: number;
  protected uploading = false;
  protected uploadStatus = '';
  protected uploadSub: Subscription;
  /**
   * Have a singe file that can be set
   */
  protected file: File;
  /**
   * Report all files dropped if mode is event
   */
  @Output() filesDropped: EventEmitter<File[]> = new EventEmitter();

  constructor(
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  public get isUploadMode() {
    return this.endpoint;
  }

  public get message() {
    return `Drag ${this.desiredFileName ? this.desiredFileName : 'file(s)'} here`;
  }

  onFileSelected(event) {
    const file: File = event.target.files[0];

    if (file) {
      this.file = file;
      this.uploadStatus = `${file.name} selected. Activate Upload file to continue.`;
      // Re-selecting the same file after cancellation/failure must emit change again.
      event.target.value = '';
    }
  }

  public onFileDragOver(files: FileList) {
    if (this.uploading) {
      return;
    }
    // iterate over FileList
    const droppedFiles = Array.from(files as ArrayLike<File>);
    for (const f of droppedFiles) {
      if (!this.accept.includes(f.type)) {
        return;
      }
    }
    this.file = files[0];
    this.upload();
  }

  public upload() {
    if (!this.file || this.uploading) {
      return;
    }

    if (this.mode == 'endpoint') {
      if (this.file) {
        const formData = new FormData();

        formData.append('file', this.file);
        this.uploading = true;
        this.uploadProgress = 0;
        this.uploadStatus = `Uploading ${this.file.name}.`;
        this.uploadSub = this.http
          .post(this.endpoint, formData, {reportProgress: true, observe: 'events'})
          .subscribe(
            (data) => {
              if (data.type == HttpEventType.UploadProgress && data.total) {
                this.uploadProgress = Math.round(100 * (data.loaded / data.total));
              }
              if (data.type == HttpEventType.Response) {
                if (data.ok) {
                  this.uploadStatus = 'File uploaded successfully.';
                  this.alert.success(`File uploaded successfully`);
                  this.uploadSuccess.emit(data as HttpResponse<object>);
                }
              }
            },
            (error) => this.handleError(error),
            () => this.reset(),
          );
      }
    } else {
      this.uploadStatus = `${this.file.name} selected.`;
      this.filesDropped.emit([this.file]);
      this.reset();
    }
  }

  private handleError(error: HttpErrorResponse) {
    const errorMessage = `Error uploading file: ${error}`;
    this.uploadStatus = 'Upload failed. Choose the file again to retry.';
    this.alert.error(errorMessage);
    this.reset();
    return throwError(() => new Error(errorMessage));
  }

  cancelUpload() {
    this.uploadSub?.unsubscribe();
    this.uploadStatus = 'Upload cancelled.';
    this.reset();
  }

  reset() {
    this.uploading = false;
    this.file = null;
    this.uploadProgress = null;
    this.uploadSub = null;
  }
}
