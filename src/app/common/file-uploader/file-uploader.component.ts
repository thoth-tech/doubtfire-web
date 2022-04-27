import { Component, Input, } from '@angular/core';

@Component({
  selector: 'file-uploader',
  templateUrl: 'file-uploader.component.html',
  styleUrls: ['file-uploader.component.scss'],
})
export class FileUploaderComponent {
    @Input() upload: any;
    @Input() files: { length: any; };
    @Input() clearEnqueuedUpload: { (arg0: any): any; (upload: any): {}; };
    @Input() showName: boolean;
    @Input() singleDropZone: boolean;
    @Input() asButton: boolean;
    @Input() showUploader: boolean;
    @Input() showUploadButton: boolean;
    @Input() resetAfterUpload: boolean;
    @Input() modelChanged: (newFiles: any, upload: any) => {};
    @Input() filesSelected: any;
    @Input() uploadZones: any;
    @Input() selectedFiles: any;
    @Input() shownUploadZones: {};
    @Input() dropSupported: boolean;
    @Input() $watch: (arg0: string, arg1: (files: any, oldFiles: any) => any) => void;
    @Input() readyToUpload: { (): any; (): boolean; };
    @Input() isReady: boolean;
    @Input() resetUploader: { (): void; (): any; };
    @Input() uploadingInfo: { complete: any; success: any; error: any; progress: any; };
    @Input() isUploading: boolean;
    @Input() onClickFailureCancel: any;
    @Input() initiateUpload: () => any;
    @Input() onBeforeUpload: () => void;
    @Input() payload: { [x: string]: any; };
    @Input() onSuccess: (arg0: any) => void;
    @Input() onComplete: () => void;
    @Input() onFailure: (arg0: any) => void; 
    @Input() $apply: () => any; 
    @Input() method: string; 
    @Input() url: any;
    @Input() $timeout: (arg0: { (): boolean; (): any; (): any; }, arg1: number) => void; 
    @Input() currentUser: { authenticationToken: any; profile: { username: any; }};


    bindings: {
    // Files map a key (file name to be uploaded) to a value (containing a
    // a display name, and the type of file that is to be accepted, where
    // type is one of [document, csv, archive, code, image]
    // E.g.:
    // { file0: { name: 'Silly Name Code', type: 'code'  },
    //   fileX: { name: 'Silly name Shot', type: 'image' } ... }
    files: '=',
    // URL to where image is to be uploaded
    url: '=',
    // Optional HTTP method used to post data (defaults to POST)
    method: '@',
    // Other payload data to pass in the upload
    // E.g.:
    // { unit_id: 10, other: { key: data, with: [array, of, stuff] } ... }
    payload: '=?',
    // Optional function to notify just prior to upload, enables injection of payload for example
    onBeforeUpload: '=?',
    // Optional function to perform on success (with one response parameter)
    onSuccess: '=?',
    // Optional function to perform on failure (with one response parameter)
    onFailure: '=?',
    // Optional function to perform when the upload is successful and about
    // to go back into its default state
    onComplete: '=?',
    // This value is bound to whether or not the uploader is currently uploading
    isUploading: '=?',
    // This value is bound to whether or not the uploader is ready to upload
    isReady: '=?',
    // Shows the names of files to be uploaded (defaults to true)
    showName: '=?',
    // Shows initially as button
    asButton: '=?',
    // Exposed files that are in the zone
    filesSelected: '=?',
    // Whether we have one or many drop zones (default is false)
    singleDropZone: '=?',
    // Whether or not we show the upload button or do we hide it allowing an
    // external trigger to upload (default is true)
    showUploadButton: '=?',
    // Sets this scope variable to a function that can then be triggered externally
    // from outside the scope
    initiateUpload: '=?',
    // What happens when we click cancel on failure
    onClickFailureCancel: '=?',
    // Whether we should reset after upload
    resetAfterUpload: '=?'  
    }

  constructor() { 
    //
    // Accepted upload types with associated data
    //
    const ACCEPTED_TYPES = {
      document: {
        extensions: ['pdf', 'ps'],
        icon:       'fa-file-pdf-o',
        name:       'PDF'
      },
      csv: {
        extensions: ['csv','xls','xlsx'],
        icon:       'fa-file-excel-o',
        name:       'CSV'
      },
      code: {
        extensions: ['pas', 'cpp', 'c', 'cs', 'h', 'java', 'py', 'js', 'html', 'coffee', 'rb', 'css',
                    'scss', 'yaml', 'yml', 'xml', 'json', 'ts', 'r', 'rmd', 'rnw', 'rhtml', 'rpres', 'tex',
                    'vb', 'sql', 'txt', 'md', 'jack', 'hack', 'asm', 'hdl', 'tst', 'out', 'cmp', 'vm', 'sh', 'bat',
                    'dat'],
        icon:       'fa-file-code-o',
        name:       'code'
      },
      image: {
        extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
        name:       'image',
        icon:       'fa-file-image-o'
      },
      zip: {
        extensions: ['zip', 'tar.gz', 'tar'],
        name:       'archive',
        icon:       'fa-file-zip-o'
      }
    };
    
    //
    // Error handling; check if empty files
    //
    if ((this.files != null ? this.files.length : undefined) === 0) { throw Error("No files provided to uploader"); }
  
    //
    // Whether or not clearEnqueuedFiles is enabled
    //
    this.clearEnqueuedUpload = function(upload: { model: any; }) {
      upload.model = null;
      return refreshShownUploadZones();
    }

    //
    // Default showName
    //
    if (this.showName == null) { this.showName = true; }
    
    //
    // Default singleDropZone
    //
    if (this.singleDropZone == null) { this.singleDropZone = false; }

    //
    // Default asButton
    //
    if (this.asButton == null) { this.asButton = false; }    
    
    //
    // Only initially show uploader if not presenting as button
    //
    this.showUploader = !this.asButton;
    
    //
    // Default show upload button
    //
    if (this.showUploadButton == null) { this.showUploadButton = true; }
    
    //
    // Default resetAfterUpload to true
    //
    if (this.resetAfterUpload == null) { this.resetAfterUpload = true; }

    //
    // When a file is dropped, if there has been rejected files
    // warn the user that that file is not okay
    //
    const checkForError = function(upload: { rejects: { length: any; }; display: { error: boolean; }; }) {
      if ((upload.rejects != null ? upload.rejects.length : undefined) > 0) {
        upload.display.error = true;
        upload.rejects = null;
        setTimeout((() => upload.display.error = false), 4000);
        return true;
      }
      return false;
    };

  }
}