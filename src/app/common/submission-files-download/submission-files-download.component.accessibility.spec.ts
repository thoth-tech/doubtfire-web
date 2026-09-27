import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpResponse} from '@angular/common/http';
import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {expectAccessible} from '../testing/accessibility';
import {SubmissionFilesDownloadComponent} from './submission-files-download.component';

@Component({
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations -- Host the real download template in the shell landmark.
  template: '<main><f-submission-files-download></f-submission-files-download></main>',
  standalone: false,
})
class DownloadRouteHost {}

describe('Submission download landmark', () => {
  let fixture: ComponentFixture<DownloadRouteHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DownloadRouteHost, SubmissionFilesDownloadComponent],
      imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {snapshot: {paramMap: convertToParamMap({projectId: '1', taskDefId: '2'})}},
        },
        {provide: DoubtfireConstants, useValue: {API_URL: '/api'}},
        {
          provide: FileDownloaderService,
          useValue: {
            downloadBlob: vi.fn((_url, success) =>
              success('blob:synthetic-files', new HttpResponse({body: new Blob()})),
            ),
            downloadBlobToFile: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DownloadRouteHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders download feedback inside the shell main without another main landmark', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('main, [role="main"]').length).toBe(1);
    const content = element.querySelector('f-submission-files-download');
    expect(content.querySelector('main, [role="main"]')).toBeNull();
    expect(content.textContent).toContain('Submitted files downloaded.');
    expect(content.querySelector('.min-h-screen')).not.toBeNull();
    await expectAccessible(element);
  });
});
