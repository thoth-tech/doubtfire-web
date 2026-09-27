import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {ACCEPTED_TYPES} from './file-upload-types';

export {ACCEPTED_TYPES} from './file-upload-types';

export interface FileData {
  name: string;
  type: string;
}

export type FileUploadSpec = FileData[] | Record<string, FileData>;

interface UploadDisplay {
  name: string;
  icon: string;
  type: string;
  error: boolean;
}
interface UploadZone {
  name: string;
  model: File[];
  accept: string;
  accepts: string[];
  rejects: string[];
  display: UploadDisplay;
}

interface UploadingInfo {
  progress: number;
  success: boolean;
  error: string;
  complete: boolean;
}

@Component({
  selector: 'f-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FileUploaderComponent implements OnInit, OnChanges, OnDestroy {
  @Input() files: FileUploadSpec;
  @Input() url: string;
  @Input() method = 'POST';
  @Input() describedBy: string | null = null;
  @Input() payload?: unknown;

  @Input() onBeforeUpload?: () => void;
  @Input() onSuccess?: (response) => void;
  @Input() onFailure?: (response) => void;
  @Input() onComplete?: () => void;
  @Input() onClickFailureCancel?: () => void;
  @Input() onCancelUpload?: () => void;

  @Input() isUploading: boolean;
  @Input() isReady: boolean;
  @Input() showName: boolean = true;
  @Input() asButton: boolean = false;
  @Input() singleDropZone: boolean = false;
  /**
   * Set false when the host shows its own confirmation after a successful upload,
   * so the two do not play one after the other. A failure still reports here,
   * because only this component knows how to retry it.
   */
  @Input() showSuccessState: boolean = true;
  /**
   * Set false when the host draws the in-flight state itself, so one panel can
   * carry the upload all the way into its own confirmation instead of handing
   * over to a second one. A failure still reports here.
   */
  @Input() showProgressState: boolean = true;
  @Input() showUploadButton: boolean = true;
  @Input() resetAfterUpload: boolean = true;
  /**
   * What the in-flight panel calls what is being sent. This component is shared
   * with the CSV importers and the group-set editor, where "your work" is a
   * tutor's enrolment file and belongs to nobody.
   */
  @Input() uploadingLabel: string = 'Uploading';

  @Input() initiateUpload?: () => void;

  // HACK: workaround for TypeScript -> Coffeescript communication
  // Once all parent components such as upload-submission-modal are migrated..
  // .. these *wont* be necessary anymore
  // Parent components should declare the file-uploader using @ViewChild() and directly call initiateUpload()
  @Output() isReadyChange: EventEmitter<boolean> = new EventEmitter();
  @Output() uploadReady: EventEmitter<() => void> = new EventEmitter();

  public readonly ACCEPTED_TYPES = ACCEPTED_TYPES;

  public showUploader: boolean = false;
  public uploadingInfo: UploadingInfo = null;

  public shownUploadZones: UploadZone[] = [];
  public uploadZones: UploadZone[] = [];
  public dropSupported: boolean = true;
  /** The zone a file is being dragged over, for the drag-over style only. */
  public dragOverZone: UploadZone | null = null;

  constructor(
    private userService: UserService,
    private constants: DoubtfireConstants,
  ) {}

  private externalName: string = 'OnTrack';
  private externalNameSub: Subscription | null = null;
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRequest?: XMLHttpRequest;
  private uploadWasCancelled = false;

  ngOnInit(): void {
    this.showUploader = !this.asButton;
    this.createUploadZones(this.files);

    this.uploadReady.emit(this.initiateUploadInternal.bind(this));

    if (!this.onClickFailureCancel) {
      this.onClickFailureCancel = this.resetUploader;
    }

    this.resetUploader();

    this.externalNameSub = this.constants.ExternalName.subscribe((name) => {
      this.externalName = name;
    });
  }

  ngOnDestroy(): void {
    // ExternalName is a BehaviorSubject on a root service, so it never
    // completes. Left subscribed, every dialog that has ever held an uploader
    // stays in memory for the session.
    this.externalNameSub?.unsubscribe();
    this.externalNameSub = null;

    // The completion callback runs on a delay, and the host it calls back into
    // may be gone by then: closing the dialog in that window had a destroyed
    // component apply the submission and claim its confirmation, so the student
    // was told nothing at all.
    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['files']) {
      this.createUploadZones(changes.files.currentValue);
      this.updateReadyState(this.readyToUpload());
    }
  }

  public backToUpload() {
    this.isUploading = false;
    this.uploadingInfo = null;
  }

  public onDragOver(event: DragEvent, upload?: UploadZone) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverZone = upload ?? null;
  }

  public onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverZone = null;
  }

  public onFileDropped(event: DragEvent, upload: UploadZone) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverZone = null;

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setUploadFile(upload, file);
    }
  }

  public onFileSelected(event: Event, upload: UploadZone) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setUploadFile(upload, file);
    }
    input.value = '';
  }

  private setUploadFile(upload: UploadZone, file: File) {
    upload.model = [file];
    this.validateFiles();
  }

  validateFiles() {
    for (const upload of this.shownUploadZones) {
      if (upload.model?.length) {
        const name: string = upload.model[0].name.toLowerCase();
        const accepts: string[] = upload.accepts.map((ext: string) =>
          ext.toLowerCase().replace(/^\./, ''),
        );
        const valid = accepts.some((ext) => name.endsWith(`.${ext}`));
        if (!valid) {
          upload.model = null;
          upload.display.error = true;
          setTimeout(() => {
            upload.display.error = null;
          }, 5000);
        }
      }
    }
    this.refreshShownUploadZones();
    this.updateReadyState(this.readyToUpload());
  }

  clearEnqueuedUpload(upload: UploadZone) {
    upload.model = null;
    this.refreshShownUploadZones();
    this.updateReadyState(this.readyToUpload());
  }

  /**
   * The summary column beside the drop zone is a second copy of the same state.
   * It earns its place only when there is more than one file to keep track of;
   * with one, the zone becomes the selected file in place instead.
   */
  public get showSummaryColumn(): boolean {
    return this.singleDropZone && this.uploadZones.length > 1;
  }

  /**
   * With the summary column the left side narrows to the next zone still waiting
   * for a file. Without it, every zone stays on screen and each one turns into
   * its own selected file, so nothing disappears when a file is chosen.
   */
  public get renderedUploadZones(): UploadZone[] {
    return this.showSummaryColumn ? this.shownUploadZones : this.uploadZones;
  }

  /**
   * The request has landed but the host has not taken over yet. Completion fires
   * `onComplete` on a short delay, and unmounting this panel the moment the bytes
   * arrive left the dialog empty for that whole window.
   */
  public get uploadSettling(): boolean {
    return (
      !this.showSuccessState &&
      this.uploadingInfo?.complete === true &&
      this.uploadingInfo?.success === true
    );
  }

  /** A success this component is showing itself, rather than handing over. */
  public get uploadComplete(): boolean {
    return this.showSuccessState && this.uploadLanded;
  }

  public get showProgressPanel(): boolean {
    if (!this.showProgressState) {
      return false;
    }
    return !this.uploadingInfo?.complete || this.uploadSettling || this.uploadComplete;
  }

  public get uploadTitle(): string {
    if (this.uploadComplete || this.uploadSettling) {
      return 'Uploaded';
    }
    return this.uploadingLabel;
  }

  /** Percent sent so far, for a host drawing the in-flight state itself. */
  public get uploadProgress(): number {
    return this.uploadingInfo?.progress ?? 0;
  }

  /** True once the bytes are away, whether or not the host has taken over. */
  public get uploadLanded(): boolean {
    return this.uploadingInfo?.complete === true && this.uploadingInfo?.success === true;
  }

  /**
   * Bytes actually on the wire. `isUploading` stays true after the request
   * settles, because the panels that report the outcome are rendered under it,
   * so a host asking "is there something here I would interrupt?" has to ask
   * this instead.
   */
  public get uploadInFlight(): boolean {
    return this.isUploading && this.uploadingInfo?.complete !== true;
  }

  /** The file being sent, or a count once there is more than one. */
  public get uploadingFileLabel(): string {
    const named = this.uploadZones
      .map((zone) => zone.model?.[0]?.name)
      .filter((name): name is string => !!name);

    if (named.length === 0) {
      return '';
    }
    return named.length === 1 ? named[0] : `${named.length} files`;
  }

  readyToUpload(): boolean {
    return this.uploadZones.every((zone) => zone.model?.length);
  }

  hasSelectedFiles(): boolean {
    return this.uploadZones.some((zone) => zone.model?.length);
  }

  updateReadyState(ready: boolean) {
    this.isReady = ready;
    this.isReadyChange.emit(ready);
  }

  resetUploader() {
    this.uploadingInfo = null;
    this.isUploading = false;
    this.showUploader = !this.asButton;
    for (const upload of this.uploadZones) {
      upload.model = null;
    }
    this.refreshShownUploadZones();
    this.updateReadyState(this.readyToUpload());
  }

  initiateUploadInternal() {
    if (!this.readyToUpload()) {
      return;
    }
    if (this.onBeforeUpload) {
      this.onBeforeUpload();
    }

    this.uploadingInfo = {
      progress: 5,
      success: null,
      error: null,
      complete: false,
    };

    this.isUploading = true;

    const xhr = new XMLHttpRequest();
    this.activeRequest = xhr;
    this.uploadWasCancelled = false;
    const form = new FormData();

    // Append files
    for (const zone of this.uploadZones) {
      if (zone.model?.length) {
        form.append(zone.name, zone.model[0]);
      }
    }

    // Append payload
    if (this.payload) {
      for (const [key, value] of Object.entries(this.payload)) {
        let v = value;
        if (typeof v === 'object') {
          v = JSON.stringify(v);
        }
        form.append(key, v);
      }
    }

    xhr.upload.onprogress = (event) => {
      if (event.total) {
        this.uploadingInfo.progress = Math.floor((event.loaded / event.total) * 100);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        this.activeRequest = undefined;
        if (this.uploadWasCancelled) {
          return;
        }

        queueMicrotask(() => {
          this.uploadingInfo.complete = true;
          let response;
          try {
            response = JSON.parse(xhr.responseText);
          } catch (e) {
            console.error(e);
            if (xhr.status === 0) {
              if (navigator.onLine === false) {
                response = {error: 'You appear to be offline. Your files have not been submitted.'};
              } else {
                response = {error: `Could not connect to the ${this.externalName} server.`};
              }
            } else {
              response = xhr.responseText;
            }
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            this.onSuccess?.(response);
            this.uploadingInfo.success = true;
            this.completionTimer = setTimeout(() => {
              this.completionTimer = null;
              this.onComplete?.();
              if (this.resetAfterUpload) {
                this.resetUploader();
              }
            }, 800);
          } else {
            this.onFailure?.(response);
            this.uploadingInfo.success = false;
            this.uploadingInfo.error = (response?.error ?? 'Unknown error') as string;
          }
        });
      }
    };
    const method = this.method ?? 'POST';
    xhr.open(method, this.url, true);

    xhr.setRequestHeader('Auth-Token', this.userService.currentUser.authenticationToken);
    xhr.setRequestHeader('Username', this.userService.currentUser.username);

    xhr.send(form);
  }

  cancelUpload(): void {
    if (!this.activeRequest || !this.isUploading || this.uploadingInfo?.complete) {
      return;
    }

    this.uploadWasCancelled = true;
    this.activeRequest.abort();
    this.activeRequest = undefined;
    this.uploadingInfo = null;
    this.isUploading = false;
    this.onCancelUpload?.();
  }

  /** What the drop zone asks for, e.g. "PDF" or "code file". */
  public dropNoun(upload: UploadZone): string {
    const type = upload.display.type;
    if (type === 'PDF' || type === 'image') {
      return type;
    }
    return `${type === 'zip' ? 'ZIP' : type} file`;
  }

  /** The accepted formats in words, e.g. "PDF or PS", shortened when the list is long. */
  public acceptedFormatsLabel(upload: UploadZone): string {
    const formats = upload.accepts.map((ext) => ext.toUpperCase());
    const previewLimit = 4;
    if (formats.length > previewLimit) {
      const rest = formats.length - previewLimit;
      return `${formats.slice(0, previewLimit).join(', ')} and ${rest} more`;
    }
    if (formats.length <= 1) {
      return formats.join('');
    }
    return `${formats.slice(0, -1).join(', ')} or ${formats[formats.length - 1]}`;
  }

  /** A file size in words, e.g. "1.2 MB". */
  public formatSize(bytes: number | undefined): string {
    if (bytes == null || !Number.isFinite(bytes)) {
      return '';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  }

  // onClickFailureCancelInternal() {
  //   console.log('onClickFailureCancelInternal');
  // }

  refreshShownUploadZones = () => {
    if (this.singleDropZone) {
      const firstEmpty = this.uploadZones.find((z) => !z.model || z.model.length === 0);
      this.shownUploadZones = firstEmpty ? [firstEmpty] : [];
    }
  };

  createUploadZones(files: FileUploadSpec) {
    const zones = Object.entries(files).map(([uploadName, uploadData]) => {
      const uploadType = uploadData.type === 'archive' ? 'zip' : uploadData.type;
      const typeData = ACCEPTED_TYPES[uploadType];
      if (!typeData) {
        throw new Error(`Invalid type provided to File Uploader ${uploadData.type}`);
      }

      return {
        name: uploadName,
        model: null,
        accept: `.${typeData.extensions.join(',.')}`,
        accepts: typeData.extensions,
        rejects: null,
        display: {
          name: uploadData.name,
          icon: typeData.icon,
          type: typeData.name,
          error: false,
        },
      };
    });

    this.shownUploadZones = this.singleDropZone ? [zones[0]] : zones;
    this.uploadZones = zones;
  }
}
