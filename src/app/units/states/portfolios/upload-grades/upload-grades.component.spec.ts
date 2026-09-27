import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {SidekiqJob} from 'src/app/api/models/sidekiq-job';
import {Unit} from 'src/app/api/models/unit';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {UploadGradesComponent} from './upload-grades.component';

describe('UploadGradesComponent', () => {
  let component: UploadGradesComponent;
  let uploadShow: ReturnType<typeof vi.fn>;
  let resultShow: ReturnType<typeof vi.fn>;
  let sidekiqShow: ReturnType<typeof vi.fn>;
  let alertError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    uploadShow = vi.fn();
    resultShow = vi.fn();
    sidekiqShow = vi.fn();
    alertError = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        UploadGradesComponent,
        {provide: CsvUploadModalService, useValue: {show: uploadShow}},
        {provide: CsvResultModalService, useValue: {show: resultShow}},
        {provide: SidekiqProgressModalService, useValue: {show: sidekiqShow}},
        {provide: AlertService, useValue: {error: alertError}},
      ],
    });

    component = TestBed.inject(UploadGradesComponent);
    component.unit = {gradesCSVUploadUrl: 'https://api.test/units/1/grades/csv'} as Unit;
  });

  function finishUpload(job: SidekiqJob): void {
    sidekiqShow.mockReturnValue(of(job));
    component.uploadGradesCSV();
    const onSuccess = uploadShow.mock.calls[0][4] as (response: SidekiqJob) => void;
    onSuccess({id: 'job-1'} as SidekiqJob);
  }

  // The file picker called the grades file "Feedback Templates CSV Data".
  it('asks for a grades CSV', () => {
    component.uploadGradesCSV();

    const [title, , files, url] = uploadShow.mock.calls[0];
    expect(title).toBe('Upload grades');
    expect(files).toEqual({file: {name: 'Grades CSV', type: 'csv'}});
    expect(url).toBe('https://api.test/units/1/grades/csv');
  });

  it('shows the results and tells the page the grades changed', () => {
    const imported = vi.fn();
    component.imported.subscribe(imported);

    finishUpload({result: '{"success": [], "errors": [], "ignored": []}'} as SidekiqJob);

    expect(imported).toHaveBeenCalledTimes(1);
    expect(resultShow).toHaveBeenCalledWith('Student grade import results', {
      success: [],
      errors: [],
      ignored: [],
    });
  });

  // JSON.parse threw inside the subscription when the job had no readable result.
  it('says so when the results cannot be read, instead of throwing', () => {
    expect(() => finishUpload({result: 'not json'} as SidekiqJob)).not.toThrow();

    expect(resultShow).not.toHaveBeenCalled();
    expect(alertError).toHaveBeenCalledWith(
      'The grades were imported, but the results could not be shown',
      6000,
    );
  });
});
