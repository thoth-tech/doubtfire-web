//
// Dialog that walks a convenor through sending the unit's portfolio grades to D2L
//
import {HttpClient} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, Inject, Injectable, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from '@angular/material/dialog';
import {D2lAssessmentMapping} from 'src/app/api/models/d2l/d2l_assessment_mapping';
import {D2lAssessmentMappingService} from 'src/app/api/models/doubtfire-model';
import {Unit} from 'src/app/api/models/unit';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-d2l-transfer',
  templateUrl: 'd2l-transfer.component.html',
  styleUrl: 'd2l-transfer.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class D2lTransferComponent implements OnInit {
  public d2lDataMapping: D2lAssessmentMapping = new D2lAssessmentMapping(this.data);
  public loadingMapping = true;
  public startingTransfer = false;
  private apiEndpoint: string;
  private weightedUnit: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Unit,
    @Inject(MatDialogRef<D2lTransferComponent>)
    public dialogRef: MatDialogRef<D2lTransferComponent>,
    private alertService: AlertService,
    public d2lAssessmentMappingService: D2lAssessmentMappingService,
    public httpClient: HttpClient,
    public doubtfireConstants: DoubtfireConstants,
    public fileDownloader: FileDownloaderService,
  ) {}

  public ngOnInit(): void {
    this.data.loadD2lMapping().subscribe({
      next: (d2lDataMapping) => {
        this.d2lDataMapping = d2lDataMapping;
        this.loadingMapping = false;

        // If we have the org unit it, then we can check the grading standard
        if (this.d2lDataMapping.orgUnitId) {
          this.checkUnitGradesWeighted();
        }
      },
      error: (_err) => {
        // No mapping found, create a new one
        this.d2lDataMapping = new D2lAssessmentMapping(this.data);
        this.loadingMapping = false;
      },
    });

    this.httpClient.get<string>(`${this.doubtfireConstants.API_URL}/d2l/endpoint`).subscribe({
      next: (response) => {
        this.apiEndpoint = response;
      },
      error: (err) => {
        this.alertService.error(`Failed to get location of D2L instance: ${err}`);
      },
    });
  }

  public checkUnitGradesWeighted(): void {
    this.httpClient
      .get<boolean>(`${this.doubtfireConstants.API_URL}/units/${this.data.id}/d2l/grades/weighted`)
      .subscribe({
        next: (response) => {
          this.weightedUnit = response;
        },
        error: (err) => {
          this.alertService.error(`Failed to get unit weighted status: ${err}`);
        },
      });
  }

  public openD2l(): void {
    const url = `${this.doubtfireConstants.API_URL}/d2l/login_url`;
    this.httpClient.post<string>(url, {}).subscribe({
      next: (response) => {
        window.open(response, '_blank');
      },
      error: (err) => {
        this.alertService.error(`Failed to get D2L login URL: ${err}`);
      },
    });
  }

  // The grade item lives on the D2L site, whose address arrives from the api. Until it
  // does, the link would start with "undefined", so the button waits for it.
  public get canOpenWeightPage(): boolean {
    return !!this.apiEndpoint;
  }

  public openWeightPage(): void {
    if (!this.canOpenWeightPage) {
      return;
    }

    const url = `${this.apiEndpoint}/d2l/lms/grades/admin/manage/item_props_newedit.d2l?objectId=${this.d2lDataMapping.gradeObjectId}&ou=${this.d2lDataMapping.orgUnitId}&scroll=weight`;
    window.open(url, '_blank');
  }

  public hasD2lMapping(): boolean {
    return this.d2lDataMapping.id !== undefined;
  }

  public hasWeight(): boolean {
    return this.weightedUnit;
  }

  // A second click while the first request is out would queue a second transfer.
  public startTransfer(): void {
    if (this.startingTransfer) {
      return;
    }

    this.startingTransfer = true;
    const url = `${this.doubtfireConstants.API_URL}/units/${this.data.id}/d2l/grades`;
    this.httpClient.post(url, {}).subscribe({
      next: () => {
        this.startingTransfer = false;
        this.alertService.success('Transfer started');
      },
      error: (err) => {
        this.startingTransfer = false;
        this.alertService.error(`Failed to start transfer: ${err}`);
      },
    });
  }

  public downloadRecord(): void {
    this.httpClient
      .get<GradesAvailableResponse>(
        `${this.doubtfireConstants.API_URL}/units/${this.data.id}/d2l/grades/available`,
      )
      .subscribe({
        next: (response) => {
          if (response.running) {
            this.alertService.error('Transfer in progress, please wait');
          } else if (response.available) {
            const url = `${this.doubtfireConstants.API_URL}/units/${this.data.id}/d2l/grades`;
            this.fileDownloader.downloadFile(url, `${this.data.code}-d2l-grades.csv`);
          } else {
            this.alertService.error(
              'No grade transfer results are available, and grade transfer does not appear to be in progress',
            );
          }
        },
        error: (err) => {
          this.alertService.error(`Failed to download record: ${err}`);
        },
      });
  }
}

/**
 * Opens the D2L grade transfer dialog for a unit
 */

@Injectable()
export class D2lTransferModal {
  constructor(public dialog: MatDialog) {}

  public open(unit: Unit): void {
    this.dialog.open(D2lTransferComponent, {
      width: '600px',
      data: unit,
    });
  }
}

interface GradesAvailableResponse {
  available: boolean;
  running: boolean;
}
