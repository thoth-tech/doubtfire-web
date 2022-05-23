//IMPORTANT: READ ALL COMMENTS BEFORE BEINGING MIGRATION

import { Component, Inject, Input, } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as _ from 'lodash';
import { currentUser } from 'src/app/ajs-upgraded-providers';
import API_URL from 'src/app/config/constants/apiURL';

//FIX: remove https://github.com/danialfarid/ng-file-upload from code as HttpClient can perform upload instead


@Component({
  selector: 'file-uploader',
  templateUrl: 'file-uploader.component.html',
  styleUrls: ['file-uploader.component.scss'],
})
export class FileUploaderComponent {
    @Input() upload: any;
    @Input() files: { length: any; };
    clearEnqueuedUpload: { (arg0: any): any; (upload: any): {}; };
    showName: boolean;
    singleDropZone: boolean;
    asButton: boolean;
    showUploader: boolean;
    showUploadButton: boolean;
    resetAfterUpload: boolean;
    modelChanged: (newFiles: any, upload: any) => void;
    filesSelected: any;
    uploadZones: any;
    selectedFiles: any;
    shownUploadZones: {};
    dropSupported: boolean;
    watch: (arg0: string, arg1: (files: any, oldFiles: any) => any) => void;
    readyToUpload: { (): any; (): boolean; };
    isReady: boolean;
    resetUploader: { (): void; (): any; };
    uploadingInfo: { complete: any; success: any; error: any; progress: any; };
    isUploading: boolean;
    onClickFailureCancel: any;
    onBeforeUpload: () => void;
    payload: { [x: string]: any; };
    onSuccess: (arg0: any) => void;
    onComplete: () => void;
    onFailure: (arg0: any) => void; 
    method: string; 
    url: any;
    setTimeout: (arg0: { (): boolean; (): any; (): any; }, arg1: number) => void
    filename: string;
    httpClient: any;

    //TODO: Remove bindings
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



  constructor(public http: HttpClient, @Inject(currentUser) private CurrentUser: any) { 
    //
    // Accepted upload types with associated data
    //
    // TODO: Move Accepted Types into a OnInit() method, public variable -> outside contructor?
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
    // FIX: upload.model is never past out of the function
    //
    function clearEnqueuedUpload(upload:{model: any;}){
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
    function checkForError(upload: { rejects: { length: any; }; display: { error: boolean; }; }){
      if ((upload.rejects != null ? upload.rejects.length : undefined) > 0) {
        upload.display.error = true;
        upload.rejects = null;
        setTimeout((() => upload.display.error = false), 4000);
        return true;
      }
      return false;
    }

    //
    // Called when the model has changed
    // Called in html component
    //
    function modelChanged(newFiles: { length: number; }, upload: { rejects: { length: number; }, display: {error:boolean} }){
      if (!(newFiles.length > 0) && !(upload.rejects.length > 0)) { return; }
      const gotError = checkForError(upload);
      if (!gotError) {
        this.filesSelected = _.flatten(_.map(this.uploadZones, 'model'));
        if (this.singleDropZone) {
          this.selectedFiles = this.uploadZones;
          return refreshShownUploadZones();
        }
      }
    }

    //
    // Will refresh which shown drop zones are shown
    // Only changes if showing one drop zone
    //
    function refreshShownUploadZones(){
      if (this.singleDropZone) {
        // Find the first-most empty model in each zone
        const firstEmptyZone = _.find(this.uploadZones, (zone: { model: { length: number; }; }) => (zone.model == null) || (zone.model.length === 0));
        if (firstEmptyZone != null) {
          return this.shownUploadZones = [firstEmptyZone];
        } else {
          return this.shownUploadZones = [];
        }
      }
    };

    //
    // Whether or not drop is supported by this browser - assume
    // true initially, but the drop zone will alter this
    //
    this.dropSupported = true;


    //
    // Data required for each upload zone
    //TODO: Change _.map to an array
    // 
    function createUploadZones(files: any){
      const zones = _.map(files, function(uploadData: { name?: any; type?: any; }, uploadName: any) {
        const {
          type
        } = uploadData;
        const typeData = ACCEPTED_TYPES[type];
        // No typeData found?
        if (typeData == null) {
          throw Error(`Invalid type provided to File Uploader ${type}`);
        }
        const zone = {
          name:     uploadName,
          model:    null,
          accept:   "'." + typeData.extensions.join(',.') + "'",
          // Rejected files
          rejects:  null,
          display: {
            name:   uploadData.name,
            // Font awesome supports PDF (from Document),
            // CSV, Code and Image icons
            icon:   typeData.icon,
            type:   typeData.name,
            // Whether or not a reject error is shown
            error:  false
          }
        };
        return zone;
      });
      // Remove all but the active drop zone
      if (this.singleDropZone) {
        this.shownUploadZones = [_.first(zones)];
      } else {
        this.shownUploadZones = zones;
      }
      return this.uploadZones = zones;
    };
    createUploadZones(this.files);

    //
    // Watch for changes in the files, and recreate the zones when they do change
    //
    this.watch('files', (files: any, oldFiles: any) => createUploadZones(files));

    //
    // Checks if okay to upload (i.e., file models exist for each drop zone)
    //
    this.readyToUpload = () => this.isReady = _.compact(_.flatten((Array.from(this.uploadZones).map((upload: { model: any; }) => upload.model)))).length === _.keys(this.files).length;

    //
    // Resets the uploader and call it
    //
    function resetUploader(){
      // No upload info and we're not uploading
      this.uploadingInfo = null;
      this.isUploading = false;
      this.showUploader = !this.asButton;
      return Array.from(this.uploadZones).map((upload: any) =>
        clearEnqueuedUpload(upload));
    };
    resetUploader();

    //
    // Override on click failure cancel if not set to just reset uploader
    //
    if (this.onClickFailureCancel == null) { this.onClickFailureCancel = resetUploader; }
    
    //
    // Initiates the upload using HttpClient
    // Grady - This is the new uploading function
    //
    // Add success and failure errors
    //
  }
  
  //TODO: Put into ngInit?
  public initiateUpload(){
    if (!this.readyToUpload()) { return; }
    const file:File = event.target.files[0]
    if(file){
      this.filename = file.name;
      const form = new FormData();
       // Append data
    const files = (Array.from(this.uploadZones).map((zone: { name: any; model: {}; }) => ({ name: zone.name, data: zone.model[0] })));
    for (let file of Array.from(files)) { form.append(file.name, file.data); }
    // Append payload
    const payload = ((() => {
      const result = [];
      for (let k in this.payload) {
        const v = this.payload[k];
        result.push({ key: k, value: v });
      }
      return result;
    })());
    for (let payloadItem of Array.from(payload)) {
      if (_.isObject(payloadItem.value)) { payloadItem.value = JSON.stringify(payloadItem.value); }
      form.append(payloadItem.key, payloadItem.value);
    } 
    const upload = this.httpClient.post(this.API_URL, form, {headers: new HttpHeaders().set('Auth-Token', this.CurrentUser.authenticationToken)}, 
    {headers: new HttpHeaders().set('Username', this.CurrentUser.profile.username)});
    upload.subscribe({
      //TODO: Insert Error Handling - https://rxjs.dev/deprecations/subscribe-arguments
    })
    }
  }
}
