import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import {HttpClient, HttpEventType, HttpErrorResponse, HttpResponse} from '@angular/common/http';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
})
export class FileUploaderComponent implements OnInit {
  @Input() files: any = {};
  @Input() url: string = '';
  @Input() method: string = 'POST';
  @Input() payload: any = {};
  @Input() onBeforeUpload?: () => void;
  @Output() onSuccess = new EventEmitter<any>();
  @Output() onFailure = new EventEmitter<any>();
  @Output() onComplete = new EventEmitter<void>();
  @Input() isReady: boolean = false;
  @Input() showName: boolean = true;
  @Input() asButton: boolean = false;
  @Input() singleDropZone: boolean = false;
  @Input() showUploadButton: boolean = true;
  @Input() resetAfterUpload: boolean = true;

  uploadZones: any[] = [];
  shownUploadZones: any[] = [];
  dropSupported: boolean = true;
  isUploading = false;
  uploadProgress = 0;
  uploadingInfo: {complete: boolean; success?: boolean; error?: string; progress?: number} | null =
    null;
  showUploader: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.createUploadZones(this.files);
  }

  clearEnqueuedUpload(upload: any): void {
    upload.model = null;
    this.refreshShownUploadZones();
  }

  readyToUpload(): boolean {
    return this.uploadZones.every((zone) => zone.model && zone.model.length > 0);
  }

  resetUploader(): void {
    this.uploadZones.forEach((upload) => {
      upload.model = null;
      upload.rejects = null;
    });
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadingInfo = null;
    this.refreshShownUploadZones();
  }

  checkForError(upload: any): boolean {
    if (upload.rejects && upload.rejects.length > 0) {
      upload.display.error = true;
      setTimeout(() => (upload.display.error = false), 4000);
      return true;
    }
    return false;
  }

  modelChanged(event: Event, upload: any): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      upload.model = Array.from(input.files);
      this.checkForError(upload);
      this.refreshShownUploadZones();
    }
  }

  createUploadZones(files: any): void {
    this.uploadZones = Object.keys(files).map((key) => {
      const uploadData = files[key];
      const icon = this.getTypeIcon(uploadData.type);
      const accept = this.getTypeExtensions(uploadData.type)
        .map((ext) => `.${ext}`)
        .join(',');
      return {
        name: key,
        model: null,
        accept: accept,
        rejects: null,
        display: {
          name: uploadData.name,
          icon: icon,
          type: uploadData.type,
          error: false
        }
      };
    });
    this.refreshShownUploadZones();
  }

  refreshShownUploadZones(): void {
    if (this.singleDropZone) {
      const firstEmptyZone = this.uploadZones.find(
        (zone) => !zone.model || zone.model.length === 0,
      );
      if (firstEmptyZone) {
        this.shownUploadZones = [firstEmptyZone];
      } else {
        this.shownUploadZones = [];
      }
    } else {
      this.shownUploadZones = [...this.uploadZones];
    }
  }

  getTypeIcon(type: string): string {
    const icons = {
      document: 'fa-file-pdf-o',
      csv: 'fa-file-excel-o',
      code: 'fa-file-code-o',
      image: 'fa-file-image-o',
      zip: 'fa-file-zip-o',
    };
    return icons[type] || 'fa-file';
  }

  getTypeExtensions(type: string): string[] {
    const extensions = {
      document: ['pdf', 'ps'],
      csv: ['csv', 'xls', 'xlsx'],
      code: [
        'pas',
        'cpp',
        'c',
        'cs',
        'csv',
        'h',
        'hpp',
        'java',
        'py',
        'js',
        'html',
        'coffee',
        'rb',
        'css',
        'scss',
        'yaml',
        'yml',
        'xml',
        'json',
        'ts',
        'r',
        'rmd',
        'rnw',
        'rhtml',
        'rpres',
        'tex',
        'vb',
        'sql',
        'txt',
        'md',
        'jack',
        'hack',
        'asm',
        'hdl',
        'tst',
        'out',
        'cmp',
        'vm',
        'sh',
        'bat',
        'dat',
        'ipynb',
        'pml',
      ],
      image: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
      zip: ['zip', 'tar.gz', 'tar'],
    };
    return extensions[type] || [];
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer!.files);
    this.handleFiles(files);
  }

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

  initiateUpload(): void {
    if (!this.readyToUpload()) return;
    this.onBeforeUpload?.();

    const formData = new FormData();
    this.uploadZones.forEach((zone) => {
      if (zone.model && zone.model.length > 0) {
        formData.append(zone.name, zone.model[0]);
      }
    });

    Object.keys(this.payload).forEach((key) => {
      const payloadValue = this.payload[key];
      const value = typeof payloadValue === 'object' ? JSON.stringify(payloadValue) : payloadValue;
      formData.append(key, value);
    });

    this.uploadingInfo = {complete: false, progress: 5};
    this.isUploading = true;

    this.http
      .post(this.url, formData, {
        observe: 'events',
        reportProgress: true,
        responseType: 'json',
      })
      .subscribe(
        (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            if (event.total) {
              this.uploadingInfo!.progress = Math.round((100 * event.loaded) / event.total);
            }
          } else if (event instanceof HttpResponse) {
            this.isUploading = false;
            this.uploadingInfo!.complete = true;
            this.uploadingInfo!.success = true;
            this.onSuccess.emit(event.body);
            setTimeout(() => {
              if (this.resetAfterUpload) {
                this.resetUploader();
              }
              this.onComplete.emit();
            }, 2500);
          }
        },
        (error: HttpErrorResponse) => {
          this.isUploading = false;
          this.uploadingInfo!.complete = true;
          this.uploadingInfo!.success = false;
          this.uploadingInfo!.error = error.message;
          this.onFailure.emit(error.message);
        },
      );
  }
}
