import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TaskComment} from 'src/app/api/models/doubtfire-model';

export type SentAttachmentAction = 'preview' | 'download';

@Component({
  selector: 'sent-attachment-card',
  templateUrl: './sent-attachment-card.component.html',
  styleUrls: ['./sent-attachment-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SentAttachmentCardComponent {
  @Input({required: true}) comment: TaskComment;
  @Input() action: SentAttachmentAction = 'download';
  @Input() busy = false;

  @Output() activate: EventEmitter<void> = new EventEmitter();

  get fileName(): string {
    return this.comment?.attachmentFileName || this.defaultFileName;
  }

  get fileTypeLabel(): string {
    const mime = this.comment?.attachmentMimeType?.toLowerCase() ?? '';
    const extension = this.fileExtension;
    if (this.comment?.commentType === 'pdf' || mime === 'application/pdf' || extension === 'pdf') {
      return 'PDF';
    }
    if (
      this.comment?.commentType === 'document' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    ) {
      return 'DOCX';
    }
    return extension && extension.length <= 8 ? extension.toUpperCase() : 'FILE';
  }

  get icon(): string {
    if (this.fileTypeLabel === 'PDF') {
      return 'picture_as_pdf';
    }
    if (this.fileTypeLabel === 'DOCX') {
      return 'description';
    }
    return 'attach_file';
  }

  get actionLabel(): string {
    if (this.busy) {
      return 'Opening…';
    }
    return this.action === 'preview' ? 'Preview' : 'Download';
  }

  get formattedSize(): string | null {
    const size = this.comment?.attachmentByteSize;
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
      return null;
    }
    if (size < 1000) {
      return `${size} B`;
    }
    if (size < 1_000_000) {
      return `${this.round(size / 1000)} KB`;
    }
    return `${this.round(size / 1_000_000)} MB`;
  }

  get accessibleLabel(): string {
    const size = this.formattedSize ? `, ${this.formattedSize}` : '';
    return `${this.actionLabel} ${this.fileTypeLabel} attachment: ${this.fileName}${size}`;
  }

  onActivate(): void {
    if (!this.busy) {
      this.activate.emit();
    }
  }

  private get fileExtension(): string {
    const extension = this.fileName.split('.').pop();
    return extension && extension !== this.fileName ? extension.toLowerCase() : '';
  }

  private get defaultFileName(): string {
    if (this.comment?.commentType === 'pdf') {
      return 'PDF attachment';
    }
    if (this.comment?.commentType === 'document') {
      return 'Document attachment.docx';
    }
    return 'Attachment';
  }

  private round(value: number): string {
    return value >= 10 ? value.toFixed(0) : value.toFixed(1);
  }
}
