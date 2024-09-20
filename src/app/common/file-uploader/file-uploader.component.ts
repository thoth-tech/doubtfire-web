/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import {HttpClient, HttpHeaders, HttpEventType} from '@angular/common/http';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
})
export class FileUploaderComponent implements OnInit {
  @Input() files: any = {};
  @Input() url: string = '';
  @Input() method: string = 'POST';
  @Input() payload: any = {};
  // @Input() onBeforeUpload?: () => void;
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onBeforeUpload? = new EventEmitter<any>();
  // @Input() onSuccess?: (response: any) => void;
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onSuccess = new EventEmitter<any>();
  // @Input() onFailure?: (response: any) => void;
  // @Input() onComplete?: () => void;
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onFailure = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onComplete = new EventEmitter<void>();
  @Input() isUploading: boolean = false;
  @Input() isReady: boolean = false;
  @Input() showName: boolean = true;
  @Input() asButton: boolean = false;
  @Input() filesSelected: any = [];
  @Input() singleDropZone: boolean = false;
  @Input() showUploadButton: boolean = true;
  @Input() resetAfterUpload: boolean = true;

  @Output() initiateUpload = new EventEmitter<void>();

  uploadingInfo: any = null;
  shownUploadZones: any[] = [];
  uploadZones: any[] = [];
  dropSupported: boolean = true;

  showUploader: boolean = true;
  selectedFiles: any[] = [];

  ACCEPTED_TYPES = {
    document: {extensions: ['pdf', 'ps'], icon: 'fa-file-pdf-o', name: 'PDF'},
    csv: {extensions: ['csv', 'xls', 'xlsx'], icon: 'fa-file-excel-o', name: 'CSV'},
    image: {
      extensions: ['png', 'bmp', 'tiff', 'jpeg', 'jpg', 'gif'],
      icon: 'fa-file-image-o',
      name: 'image',
    },
    zip: {extensions: ['zip', 'tar.gz', 'tar'], icon: 'fa-file-zip-o', name: 'archive'},
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    console.log('t5gkt', this.uploadZones);
    if (!this.files || typeof this.files !== 'object') {
      this.files = {};
    }
    console.log('t5gkt', this.files);
    this.createUploadZones(this.files);
    if (!this.onClickFailureCancel) {
      this.onClickFailureCancel = this.resetUploader.bind(this);
    }
  }
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer!.files);
    this.handleFiles(files);
  }
  // handleFiles(_files: File[]) {
  //   throw new Error('Method not implemented.');
  // }
  handleFiles(files: File[]): void {
    files.forEach((file) => {
      this.uploadZones.forEach((zone) => {
        const extensions = zone.accept.split(',').map((ext) => ext.trim());
        if (extensions.some((ext) => file.name.endsWith(ext))) {
          zone.model = [file];
          this.refreshShownUploadZones();
        } else {
          zone.rejects = [file];
          this.checkForError(zone);
        }
      });
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  createUploadZones(files: any): void {
    this.uploadZones = Object.keys(files).map((uploadName) => {
      const uploadData = files[uploadName];
      const type = uploadData.type;
      const typeData = this.ACCEPTED_TYPES[type];

      if (!typeData) {
        throw new Error(`Invalid type provided to File Uploader: ${type}`);
      }

      return {
        name: uploadName,
        model: null,
        accept: typeData.extensions.map((ext) => `.${ext}`).join(','),
        rejects: null,
        display: {
          name: uploadData.name,
          icon: typeData.icon,
          type: typeData.name,
          error: false,
        },
      };
    });

    this.shownUploadZones = this.singleDropZone ? [this.uploadZones[0]] : this.uploadZones;
  }

  resetUploader(): void {
    this.uploadingInfo = null;
    this.isUploading = false;
    this.showUploader = !this.asButton;

    for (const upload of this.uploadZones) {
      this.clearEnqueuedUpload(upload);
    }
  }

  clearEnqueuedUpload(upload: any): void {
    upload.model = null;
    this.refreshShownUploadZones();
  }

  refreshShownUploadZones(): void {
    if (this.singleDropZone) {
      const firstEmptyZone = this.uploadZones.find(
        (zone) => !zone.model || zone.model.length === 0,
      );
      this.shownUploadZones = firstEmptyZone ? [firstEmptyZone] : [];
    }
  }

  modelChanged(newFiles: any[], upload: any): void {
    if (newFiles.length > 0 || upload.rejects?.length > 0) {
      // upload.model = Array.from(newFiles);
      // upload.model = newFiles;
      const input = event.target as HTMLInputElement;
      upload.model = Array.from(input.files);
      const gotError = this.checkForError(upload);
      if (!gotError) {
        this.filesSelected = this.uploadZones.map((zone) => zone.model).flat();
        if (this.singleDropZone) {
          this.selectedFiles = this.uploadZones;
          this.refreshShownUploadZones();
        }
      }
    }
  }

  checkForError(upload: any): boolean {
    if (upload.rejects?.length > 0) {
      upload.display.error = true;
      setTimeout(() => (upload.display.error = false), 4000);
      return true;
    }
    return false;
  }

  readyToUpload(): boolean {
    return this.uploadZones.every((zone) => zone.model && zone.model.length > 0);
  }

  initiateFileUpload(): void {
    if (!this.readyToUpload()) {
      return;
    }

    this.onBeforeUpload?.emit();

    const formData = new FormData();
    for (const zone of this.uploadZones) {
      formData.append(zone.name, zone.model[0]);
    }

    for (const key in this.payload) {
      let value = this.payload[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      formData.append(key, value);
    }

    this.uploadingInfo = {progress: 5, success: null, error: null, complete: false};
    this.isUploading = true;

    const headers = new HttpHeaders({'Auth-Token': 'auth-token', 'Username': 'username'});

    this.http
      .post(this.url, formData, {
        headers,
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / (event.total || 1));
            this.uploadingInfo.progress = progress;
          } else if (event.type === HttpEventType.Response) {
            this.uploadingInfo.complete = true;
            this.uploadingInfo.success = true;
            this.onSuccess.emit(event.body);
            setTimeout(() => {
              this.onComplete.emit();
              if (this.resetAfterUpload) {
                this.resetUploader();
              }
            }, 2500);
          }
        },
        error: (error) => {
          this.uploadingInfo.complete = true;
          this.uploadingInfo.success = false;
          this.uploadingInfo.error = error.error || 'Unknown error';
          this.onFailure.emit(error.message);
        },
      });
  }

  onClickFailureCancel?: () => void;
}
