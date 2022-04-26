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



  constructor() {}
}