import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Subscription, throwError } from 'rxjs';
import { AlertService } from '../services/alert.service';

/**
 * Allow files to be dropped for upload
 */
@Component({
  selector: 'f-file-drop',
  templateUrl: 'file-drop.component.html',
  styleUrls: ['file-drop.component.scss'],
})
export class FileDropComponent {
  /** The name of the file(s) you are asking the user to upload */
  @Input() desiredFileName: string;

  /** Is this a multi-file uploader? */
  @Input() multiple: boolean = false;

  /** The file types that are allowed to be uploaded */
  @Input() accept: string;

  /** The URL of the endpoint to POST the file to */
  @Input() endpoint: string;
  @Input() body: object;
  @Output() fileChange = new EventEmitter<File>();

  protected uploadProgress: number;
  protected uploadSub: Subscription;
  /**
   * Have a singe file that can be set
   */
  protected file: File;
  /**
   * Report all files dropped
   */
  @Output() filesDropped = new EventEmitter<File[]>();

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
    }
  }

  public onFileDragOver(files: FileList) {
    // iterate over FileList
    const droppedFiles = Array.from(files as ArrayLike<File>);
    for (const f of droppedFiles) {
      if (!this.accept.includes(f.type)) {
        return;
      }
    }

    this.filesDropped.emit(droppedFiles);
    this.file = files[0];
  }

  public upload() {
    if (this.file) {
      const formData = new FormData();

      formData.append('file', this.file);
      this.http.post(this.endpoint, formData, { reportProgress: true, observe: 'events' }).subscribe(
        (data) => {
          if (data.type == HttpEventType.UploadProgress) {
            this.uploadProgress = Math.round(100 * (data.loaded / data.total));
          }
          if (data.type == HttpEventType.Response) {
            if (data.ok) {
              this.alert.success(`File uploaded successfully`);
            }
          }
        },
        (error) => this.handleError(error),
        () => this.reset(),
      );
    }
  }

  private handleError(error: HttpErrorResponse) {
    const errorMessage = `Error uploading file: ${error}`;
    this.alert.error(errorMessage);
    this.reset();
    return throwError(() => new Error(errorMessage));
  }

  cancelUpload() {
    this.uploadSub.unsubscribe();
    this.reset();
  }

  reset() {
    this.file = null;
    this.uploadProgress = null;
    this.uploadSub = null;
  }
}