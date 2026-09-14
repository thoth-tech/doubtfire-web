import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {TeamsMeetingComposerComponent} from './teams-meeting-composer.component';
import {safeHttpsUrl} from './unit-hub-calendar';
import {LearningSession, SESSION_KINDS, UnitAnnouncement} from './unit-hub.models';

export interface UnitHubDetailsData {
  unitCode: string;
  unitName: string;
  demo: boolean;
  announcement?: Readonly<UnitAnnouncement>;
  session?: Readonly<LearningSession>;
  joinUrl?: string | null;
  googleCalendarUrl?: string | null;
  canManage: boolean;
  download?: () => void;
  calendarSettings?: () => void;
}

@Component({
  selector: 'f-unit-hub-details',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TeamsMeetingComposerComponent,
  ],
  templateUrl: './unit-hub-details.component.html',
  styleUrl: './unit-hub-details.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UnitHubDetailsComponent {
  readonly deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly safeUrl = safeHttpsUrl;
  content: UnitHubDetailsData | null;
  status = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) data: UnitHubDetailsData,
    private dialogRef: MatDialogRef<UnitHubDetailsComponent>,
  ) {
    this.content = data;
  }

  get title(): string {
    return this.content?.announcement?.title ?? this.content?.session?.title ?? '';
  }

  get sourceLabel(): string {
    const announcement = this.content?.announcement;
    return announcement?.managed_externally || announcement?.source_provider === 'microsoft_teams'
      ? 'Microsoft Teams'
      : 'OnTrack';
  }

  get sessionKind(): string {
    return (
      SESSION_KINDS.find((kind) => kind.value === this.content?.session?.kind)?.label ?? 'Session'
    );
  }

  close(): void {
    this.dialogRef.close();
  }

  /** Remove the selected record immediately when the parent account/unit/mode changes. */
  clear(): void {
    this.content = null;
    this.status = '';
  }

  download(): void {
    if (!this.content?.session || this.content.session.cancelled) {
      return;
    }
    this.content.download?.();
    this.status = this.content.demo ? 'DEMO calendar copy requested.' : 'Calendar copy requested.';
  }

  calendarSettings(): void {
    if (!this.content || this.content.demo) {
      return;
    }
    this.content.calendarSettings?.();
    this.close();
  }
}
