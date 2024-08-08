import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

@Component({
  selector: 'file-uploader',
  styleUrls: ['./file-uploader.component.scss'],
  templateUrl: './file-uploader.component.html'
})
export class FileUploaderComponent implements OnInit {
  @Input() files: any;
  @Input() url: string;
  @Input() method: string = 'POST';
  @Input() payload: any;
  @Input() onBeforeUpload: any;
  @Input() onSuccess: any;
  @Input() onFailure: any;
  @Input() onComplete: any;
  @Input() isUploading: boolean;
  @Input() isReady: boolean;
  @Input() showName: boolean = true;
  @Input() asButton: boolean = false;
  @Input() filesSelected: any;
  @Input() singleDropZone: boolean = false;
  @Input() showUploadButton: boolean = true;
  //@Input() initiateUpload: any;
  @Input() onClickFailureCancel: any;
  @Input() resetAfterUpload: boolean = true;

  public uploadingInfo: any;
  public uploadZones: any;
  public shownUploadZones: any;
  public showUploader: any;
  public selectedFiles: any;

  private ACCEPTED_TYPES = {
    document: {extensions: ['pdf', 'ps'], icon: 'fa-file-pdf-o', name: 'PDF'},
    csv: {extensions: ['csv', 'xls', 'xlsx'], icon: 'fa-file-excel-o', name: 'CSV'},
    code: {
      extensions: [
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
      icon: 'fa-file-code-o',
      name: 'code',
    },
    image: {
      extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
      name: 'image',
      icon: 'fa-file-image-o',
    },
    zip: {extensions: ['zip', 'tar.gz', 'tar'], name: 'archive', icon: 'fa-file-zip-o'},
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    if (!this.files || Object.keys(this.files).length === 0) {
      throw new Error('No files provided to uploader');
    }

    this.createUploadZones(this.files);
    this.resetUploader();

    if (!this.onClickFailureCancel) {
      this.onClickFailureCancel = this.resetUploader;
    }
  }

  createUploadZones(files: any) {
    const zones = Object.entries(files).map(([uploadName, uploadData]: [string, any]) => {
      const typeData = this.ACCEPTED_TYPES[uploadData.type];
      if (!typeData) {
        throw new Error(`Invalid type provided to File Uploader ${uploadData.type}`);
      }
      return {
        name: uploadName,
        model: null,
        accept: `.${typeData.extensions.join(',.')}`,
        rejects: null,
        display: {
          name: uploadData.name,
          icon: typeData.icon,
          type: typeData.name,
          error: false,
        },
      };
    });
    this.uploadZones = zones;
    this.shownUploadZones = this.singleDropZone ? [zones[0]] : zones;
  }

  modelChanged(newFiles: any, upload: any) {
    if (newFiles.length > 0 || upload.rejects.length > 0) {
      const gotError = this.checkForError(upload);
      if (!gotError) {
        this.filesSelected = [].concat(...this.uploadZones.map((zone: any) => zone.model));
        if (this.singleDropZone) {
          this.selectedFiles = this.uploadZones;
          this.refreshShownUploadZones();
        }
      }
    }
  }

  checkForError(upload: any) {
    if (upload.rejects.length > 0) {
      upload.display.error = true;
      upload.rejects = null;
      setTimeout(() => {
        upload.display.error = false;
      }, 4000);
      return true;
    }
    return false;
  }

  refreshShownUploadZones() {
    if (this.singleDropZone) {
      const firstEmptyZone = this.uploadZones.find(
        (zone: any) => !zone.model || zone.model.length == 0,
      );
      this.shownUploadZones = firstEmptyZone ? [firstEmptyZone] : [];
    }
  }

  readyToUpload() {
    this.isReady =
      this.uploadZones.filter((upload: any) => upload.model && upload.model.length > 0).length ===
      Object.keys(this.files).length;
    return this.isReady;
  }

  resetUploader() {
    this.uploadingInfo = null;
    this.isUploading = false;
    this.showUploader = !this.asButton;
    this.uploadZones.forEach((upload: any) => this.clearEnqueuedUpload(upload));
  }

  clearEnqueuedUpload(upload: any) {
    upload.model = null;
    this.refreshShownUploadZones();
  }

  initiateUpload() {
    if (!this.readyToUpload()) return;

    if (this.onBeforeUpload) {
      this.onBeforeUpload();
    }

    const formData = new FormData();
    this.uploadZones.forEach((zone: any) => {
      formData.append(zone.name, zone.model[0]);
    });

    if (this.payload) {
      Object.entries(this.payload).forEach(([key, value]: [string, any]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    const headers = new HttpHeaders({'Auth-Token': 'token', 'Username': 'username'});

    this.http.post(this.url, formData, {headers}).subscribe(
      (response) => {
        this.uploadingInfo = {progress: 100, success: true, complete: true};
        if (this.onSuccess) {
          this.onSuccess(response);
        }
        if (this.onComplete) {
          setTimeout(() => this.onComplete(), 2500);
          if (this.resetAfterUpload) {
            this.resetUploader();
          }
        }
      },
      (error) => {
        this.uploadingInfo = {progress: 100, success: false, complete: true, error: error.message};
        if (this.onFailure) {
          this.onFailure(error);
        }
      },
    );
  }
}
