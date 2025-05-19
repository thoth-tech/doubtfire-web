// Angular and Component Imports
import { Component, Input, OnInit } from '@angular/core';
import { UserService }                 from '../../api/services/user.service';
import { AuthenticationService }       from '../../api/services/authentication.service';

interface AcceptedType {
  extensions: string[];
  icon: string;
  name: string;
}

@Component({
  selector: 'f-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
})

export class FileUploaderComponent implements OnInit {
  // Input Properties (Scope Bindings)
  @Input() files: any;
  @Input() url: string = '';
  @Input() method: string = 'POST';
  @Input() payload: any = {};
  @Input() onBeforeUpload: () => void = () => {};
  @Input() onSuccess: (response: any) => void = () => {};
  @Input() onFailure: (response: any) => void = () => {};
  @Input() onComplete: () => void = () => {};
  @Input() isUploading: boolean = false;
  @Input() isReady: boolean = false;
  @Input() showName: boolean = true;
  @Input() asButton: boolean = false;
  @Input() filesSelected: any = [];
  @Input() singleDropZone: boolean = false;
  @Input() showUploadButton: boolean = true;
  @Input() onClickFailureCancel: () => void = () => {};
  @Input() resetAfterUpload: boolean = true;

  // Internal State
  showUploader: boolean = true;
  uploadZones: any[] = [];
  shownUploadZones: any[] = [];
  selectedFiles: any[] = [];
  dropSupported: boolean = true;
  uploadingInfo: any = null;

  // Internal State Defaults
  initializeDefaults(): void {
    this.showName = this.showName ?? true;
    this.singleDropZone = this.singleDropZone ?? false;
    this.asButton = this.asButton ?? false;
    this.showUploader = !this.asButton;
    this.showUploadButton = this.showUploadButton ?? true;
    this.resetAfterUpload = this.resetAfterUpload ?? true;
  }

  // Accepted File Types (ACCEPTED_TYPES)
  public static readonly ACCEPTED_TYPES: { [key: string]: AcceptedType } = {
    document: { extensions: ['pdf', 'ps'], icon: 'picture_as_pdf', name: 'PDF' },
    csv: { extensions: ['csv', 'xls', 'xlsx'], icon: 'table_chart', name: 'CSV' },
    code: {
      extensions: [
        'pas', 'cpp', 'c', 'cs', 'csv', 'h', 'hpp', 'java', 'py', 'js', 'html', 'coffee', 'rb', 'css',
        'scss', 'yaml', 'yml', 'xml', 'json', 'ts', 'r', 'rmd', 'rnw', 'rhtml', 'rpres', 'tex',
        'vb', 'sql', 'txt', 'md', 'jack', 'hack', 'asm', 'hdl', 'tst', 'out', 'cmp', 'vm', 'sh', 'bat',
        'dat', 'ipynb', 'pml', 'vue'
      ],
      icon: 'code',
      name: 'Code',
    },
    image: { extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'], icon: 'image', name: 'Image' },
    zip: { extensions: ['zip', 'tar.gz', 'tar'], icon: 'archive', name: 'Archive' },
  };

  constructor( private userService: UserService,
    private authService: AuthenticationService) {
  }

  ngOnInit(): void {
    this.initializeDefaults();
    this.resetUploader();
    if (!this.files || typeof this.files !== 'object' || Object.keys(this.files).length === 0) {
      console.error("Invalid files object:", this.files);
      throw new Error("No valid files provided to uploader");
    }
    this.createUploadZones(this.files);
  }

  // Check for Errors in Upload
checkForError(upload: any): boolean {
  if (upload.rejects && upload.rejects.length > 0) {
    upload.display.error = true;
    upload.rejects = null;

    setTimeout(() => {
      upload.display.error = false;
    }, 4000);

    return true;
  }
  return false;
}

// Clear Enqueued Upload
clearEnqueuedUpload(upload: any): void {
    upload.model = null;
    this.refreshShownUploadZones();
  }

// Refresh Shown Upload Zones
refreshShownUploadZones(): void {
  this.shownUploadZones = this.singleDropZone
    ? [this.uploadZones.find(zone => !zone.model || zone.model.length === 0)] || []
    : this.uploadZones;
}

  // Create Upload Zones (CoffeeScript Equivalent)
  createUploadZones(files: any): void {
  // Map the files object into an array of upload zones
  this.uploadZones = Object.keys(files).map((key) => {
    const uploadData = files[key];
    const typeData = FileUploaderComponent.ACCEPTED_TYPES[uploadData.type];

    // Validate the file type
    if (!typeData) {
      console.error(`Invalid type provided to File Uploader: ${uploadData.type}`);
      throw new Error(`Invalid type provided to File Uploader: ${uploadData.type}`);
    }

    // Create the upload zone
    return {
      name: key,
      model: null,
      accept: '.' + typeData.extensions.join(',.'),
      rejects: null,
      display: {
        name: uploadData.name,
        icon: typeData.icon,
        type: typeData.name,
        error: false
      }
    };
  });

  // Single drop zone handling
  if (this.singleDropZone) {
    this.shownUploadZones = [this.uploadZones[0]];
  } else {
    this.shownUploadZones = this.uploadZones;
  }
}
// Model Change Handler
modelChanged(newFiles: FileList, upload: any, fileInput: HTMLInputElement): void {
  if (newFiles.length === 0 && (!upload.rejects || upload.rejects.length === 0)) return;

  const validFiles = Array.from(newFiles).filter(file => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = upload.accept.split(',').map(ext => ext.trim().replace('.', ''));
    if (!allowedExtensions.includes(fileExtension || '')) {
      upload.rejects = [file];
      upload.display.error = true;
      fileInput.value = "";
      setTimeout(() => {
        upload.display.error = false;
        upload.rejects = null;
      }, 4000);
      return false;
    }
    return true;
  });

  // Update the model if valid files are present
  if (validFiles.length > 0) {
    upload.model = validFiles;
    this.filesSelected = this.uploadZones.flatMap(zone => zone.model || []);
  }
}

  // Reset Uploader
resetUploader(): void {
  this.uploadingInfo = null;
  this.isUploading = false;
  this.showUploader = !this.asButton;

  // Clear errors and rejects for all upload zones
  this.uploadZones.forEach(upload => {
    upload.model = null;
    upload.rejects = null;
    upload.display.error = false;
  });

  this.refreshShownUploadZones();
}

  // Ready to Upload Check
  readyToUpload(): boolean {
    const totalFiles = Object.keys(this.files).length;
    const selectedFiles = this.uploadZones.flatMap(zone => zone.model || []);
    this.isReady = selectedFiles.length === totalFiles;
    return this.isReady;
}

  // Handle File Drop
handleFileDrop(event: DragEvent, upload: any): void {
  event.preventDefault();

  const droppedFiles = event.dataTransfer?.files;
  if (!droppedFiles || droppedFiles.length === 0) return;

  const file = droppedFiles[0];
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = upload.accept.split(',').map(ext => ext.trim().replace('.', ''));

  // Check for valid file type
  if (!allowedExtensions.includes(fileExtension)) {
    upload.rejects = [file];
    this.checkForError(upload);
    this.refreshShownUploadZones();
    return;
  }

  // Clear any previous errors and set the file model
  upload.model = [file];
  upload.rejects = null;
  upload.display.error = false;
  this.filesSelected = this.uploadZones.flatMap(zone => zone.model || []);

  // Refresh zones for single drop zone
  if (this.singleDropZone) {
    this.selectedFiles = this.uploadZones;
    this.refreshShownUploadZones();
  }
}
  // Handle File Drag Over
  handleFileDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // Handle File Click
  handleFileClick(event: MouseEvent, upload: any, fileInput: HTMLInputElement): void {
  fileInput.click();
}
// Initialize Upload
initiateUpload(): void {
  // Check if the uploader is ready
  if (!this.readyToUpload()) return;
  this.onBeforeUpload?.();

  // Prepare FormData
  const formData = new FormData();
  const files = this.uploadZones.filter(zone => zone.model && zone.model[0]);

  files.forEach(file => {
    formData.append(file.name, file.model[0]);
  });

  // Set the initial upload state
  this.uploadingInfo = {
    progress: 0,
    success: null,
    error: null,
    complete: false,
  };
  this.isUploading = true;

  // Create and configure the XMLHttpRequest
  const xhr = new XMLHttpRequest();
  xhr.open(this.method || 'POST', this.url, true);

  // Add authentication headers
  const authToken = this.userService.currentUser.authenticationToken;
  const username = this.userService.currentUser.username;
  if (authToken) xhr.setRequestHeader('Auth-Token', authToken);
  if (username) xhr.setRequestHeader('Username', username);

  // Handle upload progress
  xhr.upload.onprogress = (event) => {
    debugger
    if (event.lengthComputable) {
      const progress = Math.round((event.loaded / event.total) * 100);
      this.uploadingInfo.progress = progress;
    }
  };

  // Handle upload completion
  xhr.onreadystatechange = () => {
    debugger
    if (xhr.readyState === 4) {
      let response: any;
      try {
        response = JSON.parse(xhr.responseText);
      } catch (e) {
        response = { error: 'Invalid server response' };
      }

      // Check if the upload was successful
      if (xhr.status >= 200 && xhr.status < 300) {
        this.uploadingInfo.success = true;
        this.onSuccess?.(response);
      } else {
        this.uploadingInfo.success = false;
        this.uploadingInfo.error = response.error || 'Unknown error';
        this.onFailure?.(response);
      }

      // Mark upload as complete
      this.uploadingInfo.complete = true;
      this.isUploading = false;
      this.onComplete?.();
    }
  };

  // Send the form data
  xhr.send(formData);
}

}