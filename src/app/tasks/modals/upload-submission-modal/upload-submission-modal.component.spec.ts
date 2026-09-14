import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {BehaviorSubject} from 'rxjs';
import {ProjectService, TaskService} from 'src/app/api/models/doubtfire-model';
import {UserService} from 'src/app/api/services/user.service';
import {FileUploaderComponent} from 'src/app/common/file-uploader/file-uploader.component';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {PrivacyPolicy} from 'src/app/config/privacy-policy/privacy-policy';
import {TaskUploadRequirementsComponent} from './task-upload-requirements/task-upload-requirements.component';
import {UploadSubmissionModalComponent} from './upload-submission-modal.component';

describe('UploadSubmissionModalComponent upload guidance', () => {
  let fixture: ComponentFixture<UploadSubmissionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        UploadSubmissionModalComponent,
        FileUploaderComponent,
        TaskUploadRequirementsComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            isTestSubmission: true,
            task: {
              definition: {
                abbreviation: '1.1P',
                name: 'Upload evidence',
                uploadRequirements: [{key: 'file0', name: 'Source code', type: 'code'}],
              },
              testSubmissionUrl: () => '/api/test-submission',
              isGroupTask: () => false,
            },
          },
        },
        {provide: MatDialogRef, useValue: {}},
        {provide: TaskService, useValue: {}},
        {provide: ProjectService, useValue: {}},
        {provide: PrivacyPolicy, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: EmojiService, useValue: {}},
        {provide: UserService, useValue: {}},
        {provide: DoubtfireConstants, useValue: {ExternalName: new BehaviorSubject('OnTrack')}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UploadSubmissionModalComponent);
    fixture.detectChanges();
  });

  it('shows guidance before selection and describes the real file picker controls', () => {
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('.file-drop-zone')!;
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    const help = root.querySelector<HTMLElement>('.task-upload-requirements')!;
    expect(help.textContent).toContain('Files required: 1');
    expect(button.getAttribute('aria-describedby')).toBe(help.id);
    expect(input.getAttribute('aria-describedby')).toBe(help.id);
    expect(help.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.accept).toContain('.vue');
    expect(fixture.componentInstance.isUploaderReady).toBe(false);
  });

  it('preserves invalid-file feedback and enables submission only after an accepted selection', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['x'], 'bad.exe')],
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invalid file provided');
    expect(fixture.componentInstance.isUploaderReady).toBe(false);

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['x'], 'source.vue')],
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.isUploaderReady).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('source.vue');
  });
});
