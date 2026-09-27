import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {Subject, of, throwError} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {
  StudentSubmissionHistory,
  SubmissionHistoryService,
} from 'src/app/api/services/submission-history.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {PreviousSubmissionsComponent} from './previous-submissions.component';

describe('Previous submissions', () => {
  const task = {id: 1, project: {id: 2}, definition: {id: 3}} as Task;
  const available = {
    id: 4,
    versionOrder: 1,
    timestamp: new Date('2026-09-20T03:00:00Z'),
    current: true,
    available: true,
  };
  let history: {
    queryStudentHistory: ReturnType<typeof vi.fn>;
    studentArchiveUrl: ReturnType<typeof vi.fn>;
  };
  let downloader: {
    downloadBlob: ReturnType<typeof vi.fn>;
    downloadBlobToFile: ReturnType<typeof vi.fn>;
    releaseBlob: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    history = {
      queryStudentHistory: vi.fn().mockReturnValue(of({versions: [], processing: false})),
      studentArchiveUrl: vi.fn().mockReturnValue('/authorised/history/4'),
    };
    downloader = {downloadBlob: vi.fn(), downloadBlobToFile: vi.fn(), releaseBlob: vi.fn()};
    TestBed.configureTestingModule({
      imports: [PreviousSubmissionsComponent],
      providers: [
        {provide: SubmissionHistoryService, useValue: history},
        {provide: FileDownloaderService, useValue: downloader},
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(PreviousSubmissionsComponent);
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();
    return fixture;
  }

  it('announces loading, processing, empty results and API failure with a retry', () => {
    const pending: Subject<StudentSubmissionHistory> = new Subject();
    history.queryStudentHistory.mockReturnValue(pending);
    const fixture = render();
    expect(fixture.nativeElement.textContent).toContain('Loading previous submissions');
    pending.next({versions: [], processing: true});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('still processing');
    expect(fixture.nativeElement.textContent).toContain('No previous submissions');
    history.queryStudentHistory.mockReturnValue(throwError(() => new Error('offline')));
    fixture.componentInstance.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'could not be loaded',
    );
    history.queryStudentHistory.mockReturnValue(of({versions: [], processing: false}));
    fixture.componentInstance.refresh();
    expect(fixture.componentInstance.error).toBe('');
  });

  it('labels current and previous versions and only offers downloads for available files', () => {
    history.queryStudentHistory.mockReturnValue(
      of({
        versions: [
          available,
          {...available, id: 5, versionOrder: 2, current: false, available: false},
        ],
        processing: false,
      }),
    );
    const fixture = render();
    const rows = fixture.nativeElement.querySelectorAll('li');
    expect(rows[0].textContent).toContain('Current submission');
    expect(rows[0].textContent).toContain('Archive file: submission-4.zip');
    expect(rows[1].textContent).toContain('Previous submission');
    expect(rows[1].textContent).toContain('Files unavailable');
    expect(rows[0].querySelector('button').getAttribute('aria-label')).toContain(
      'Download archived submission',
    );
    expect(rows[1].querySelector('button')).toBeNull();
    fixture.componentInstance.download({...available, available: false});
    expect(downloader.downloadBlob).not.toHaveBeenCalled();
    rows[0].querySelector('button').click();
    expect(downloader.downloadBlob).toHaveBeenCalled();
    downloader.downloadBlob.mock.calls[0][2]();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'no longer available',
    );
  });

  it('clears the previous task and ignores a late response or download after navigation', () => {
    const pending: Subject<StudentSubmissionHistory> = new Subject();
    history.queryStudentHistory.mockReturnValue(pending);
    const fixture = render();
    fixture.componentInstance.download(available);
    history.queryStudentHistory.mockReturnValue(of({versions: [], processing: false}));
    fixture.componentRef.setInput('task', {...task, id: 2});
    fixture.detectChanges();
    pending.next({versions: [available], processing: false});
    downloader.downloadBlob.mock.calls[0][1]('blob:old-task');
    expect(fixture.componentInstance.versions).toEqual([]);
    expect(downloader.downloadBlobToFile).not.toHaveBeenCalled();
    expect(downloader.releaseBlob).toHaveBeenCalledWith('blob:old-task');
  });
});
