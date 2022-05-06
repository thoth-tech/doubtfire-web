import { Component, Input, } from '@angular/core';
import * as _ from 'lodash';

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
    currentUser: { authenticationToken: any; profile: { username: any; }}; //Grady - possibly need to inject currentuser
    initiateUpload: () => any;

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
    // Initiates the upload
    // Grady - Needs to be replaced with httpclient
    //
    this.initiateUpload = function() {
      if (!this.readyToUpload()) { return; }
      if (typeof this.onBeforeUpload === 'function') {
        this.onBeforeUpload();
      }

      const xhr   = new XMLHttpRequest(); 
      const form  = new FormData();
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
      // Set the percent
      this.uploadingInfo = {
        progress: 5,
        success: null,
        error: null,
        complete: false
      };
      this.isUploading = true;
      // Callbacks
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          return setTimeout((function() {
            // Upload is now complete
            this.uploadingInfo.complete = true;
            let response = null;
            try {
              response = JSON.parse(xhr.responseText);
            } catch (e) {
              if (xhr.status === 0) {
                response = { error: 'Could not connect to the Doubtfire server' };
              } else {
                response = xhr.responseText;
              }
            }
            // Success (20x success range)
            if ((xhr.status >= 200) && (xhr.status < 300)) {
              if (typeof this.onSuccess === 'function') {
                this.onSuccess(response);
              }
              this.uploadingInfo.success = true;
              setTimeout((function() {
                if (typeof this.onComplete === 'function') {
                  this.onComplete();
                }
                if (this.resetAfterUpload) {
                  return this.resetUploader();
                }
              }), 2500);
            // Fail
            } else {
              if (typeof this.onFailure === 'function') {
                this.onFailure(response);
              }
              this.uploadingInfo.success = false;
              this.uploadingInfo.error   = response.error || "Unknown error";
            }
            return this.apply();
          }), 2000);
        }
      };

      xhr.upload.onprogress = function(event) {
        this.uploadingInfo.progress = parseInt((100.0 * event.position) / event.totalSize);
        return this.apply();
      };

      // Default the method to POST if it was not defined
      if (this.method == null) { this.method = 'POST'; }

      // Send it
      xhr.open(this.method, this.url, true);

      // Add auth details
      xhr.setRequestHeader('Auth-Token', this.currentUser.authenticationToken); //Grady - added this. to current users but still might need to do injection?
      xhr.setRequestHeader('Username', this.currentUser.profile.username);

      return xhr.send(form);
    };
  
  }


}
