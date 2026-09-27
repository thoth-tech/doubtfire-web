import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {SidekiqJob} from 'src/app/api/models/sidekiq-job';
import {Unit} from 'src/app/api/models/unit';
import {
  CsvResult,
  CsvResultModalService,
} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-upload-grades',
  templateUrl: 'upload-grades.component.html',
  styleUrl: 'upload-grades.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UploadGradesComponent implements OnInit {
  @Input() unit: Unit;
  @Input() disabled = false;

  // Fires when the tutor opens the results of a finished import, so the page can
  // fetch the new grades.
  @Output() imported: EventEmitter<void> = new EventEmitter();

  constructor(
    private sidekiqModalService: SidekiqProgressModalService,
    private csvUploadModal: CsvUploadModalService,
    private csvResultModal: CsvResultModalService,
    private alertService: AlertService,
  ) {}

  public ngOnInit(): void {
    if (!this.unit) {
      return console.error(`Invalid unit`);
    }
  }

  public uploadGradesCSV() {
    this.csvUploadModal.show(
      'Upload grades',
      'Use the grades CSV from the Download menu as your starting point. Each row needs unit_code, username, student_id, grade and rationale.',
      {
        file: {name: 'Grades CSV', type: 'csv'},
      },
      this.unit.gradesCSVUploadUrl,
      (response: SidekiqJob) => {
        if (!response) {
          this.alertService.error('Failed to import grades', 6000);
          return;
        }

        this.sidekiqModalService.show('Import student grades', response.id).subscribe({
          next: (job) => {
            this.imported.emit();
            this.showResults(job);
          },
          error: (error) => {
            console.error(error);
            this.alertService.error('Failed to import grades', 6000);
          },
        });
      },
    );
  }

  // The job result is JSON text written by the server. If it cannot be read, say so
  // rather than throw from inside the subscription.
  private showResults(job: SidekiqJob): void {
    let results: CsvResult;
    try {
      results = JSON.parse(job.result);
    } catch {
      this.alertService.error('The grades were imported, but the results could not be shown', 6000);
      return;
    }

    this.csvResultModal.show('Student grade import results', results);
  }
}
