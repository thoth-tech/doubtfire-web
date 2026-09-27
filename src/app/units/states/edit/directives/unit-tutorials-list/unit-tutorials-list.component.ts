import {RequestOptions} from 'ngx-entity-service';
import {HttpErrorResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {UntypedFormControl, Validators} from '@angular/forms';
import {MatSort} from '@angular/material/sort';
import {MatTable, MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {
  Campus,
  CampusService,
  Tutorial,
  TutorialService,
  TutorialStream,
  TutorialStreamService,
  Unit,
  User,
} from 'src/app/api/models/doubtfire-model';
import {EntityFormComponent} from 'src/app/common/entity-form/entity-form.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'df-unit-tutorials-list',
  templateUrl: 'unit-tutorials-list.component.html',
  styleUrls: ['unit-tutorials-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitTutorialsListComponent
  extends EntityFormComponent<Tutorial>
  implements OnInit, OnDestroy
{
  @ViewChild(MatTable, {static: true}) table: MatTable<Tutorial>;
  @ViewChild(MatSort, {static: true}) sort: MatSort;
  @Input() stream: TutorialStream;
  @Input() unit: Unit;

  days: string[] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Asynchronous',
  ];

  campuses: Campus[] = new Array<Campus>();
  columns: string[] = [
    'abbreviation',
    'campus',
    'location',
    'day',
    'time',
    'tutor',
    'capacity',
    'options',
  ];
  tutorials: Tutorial[] = [];
  dataSource: MatTableDataSource<Tutorial> = new MatTableDataSource();

  public editingStream: boolean = false;
  private subscriptions: Subscription[] = [];

  /**
   * The original stream abbreviation is required to update the stream - as it may change but is used in the url.
   */
  private origStreamAbbr: string;
  private origName: string;

  constructor(
    private tutorialService: TutorialService,
    private tutorialStreamService: TutorialStreamService,
    private campusService: CampusService,
    private confirmationModal: ConfirmationModalService,
    private alerts: AlertService,
  ) {
    super(
      {
        meetingDay: new UntypedFormControl('', [Validators.required]),
        meetingTime: new UntypedFormControl(null, [Validators.required]),
        meetingLocation: new UntypedFormControl('', [Validators.required]),
        abbreviation: new UntypedFormControl('', [Validators.required]),
        campus: new UntypedFormControl(null, []),
        capacity: new UntypedFormControl('', [Validators.required]),
        tutor: new UntypedFormControl(null, [Validators.required]),
      },
      'Tutorial',
    );

    // Sort on what each column shows. The column ids are not the property names, so the
    // table's default look-up sorted location, day and time on undefined.
    this.dataSource.sortingDataAccessor = (tutorial: Tutorial, column: string) =>
      this.sortValue(tutorial, column);
  }

  /**
   * Tutorials without a stream are older ones. The api only creates tutorials inside a
   * stream, so that list has no row for adding one.
   */
  public get canAddTutorials(): boolean {
    return !!this.stream;
  }

  public get headingId(): string {
    return `tutorial-stream-${this.stream?.abbreviation ?? 'none'}`;
  }

  ngOnInit(): void {
    if (this.stream) {
      this.origStreamAbbr = this.stream.abbreviation;
      this.origName = this.stream.name;
    }

    this.dataSource.sort = this.sort;

    this.subscriptions.push(
      this.campusService.query().subscribe((campuses) => {
        this.campuses = [...campuses];
      }),
    );

    this.filterTutorials();

    this.subscriptions.push(
      this.unit.tutorialsCache.values.subscribe((_t) => this.filterTutorials()),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  // A capacity of -1 means the tutorial has no limit.
  public capacityLabel(tutorial: Tutorial): string {
    const enrolled = tutorial.numStudents ?? 0;
    if (Number(tutorial.capacity) === -1) {
      return `${enrolled}, no limit`;
    }
    return `${enrolled} of ${tutorial.capacity ?? 0}`;
  }

  public sortValue(tutorial: Tutorial, column: string): string | number {
    switch (column) {
      case 'campus':
        return tutorial.campus?.name ?? '';
      case 'location':
        return tutorial.meetingLocation ?? '';
      case 'day': {
        const index = this.days.indexOf(tutorial.meetingDay);
        return index >= 0 ? index : this.days.length;
      }
      case 'time':
        return this.minutesIntoDay(tutorial.meetingTime);
      case 'tutor':
        return tutorial.tutor?.name ?? '';
      case 'capacity':
        return Number(tutorial.capacity) || 0;
      default:
        return tutorial.abbreviation ?? '';
    }
  }

  // Times are typed by hand, so "9:30" has to sort before "10:00".
  private minutesIntoDay(time: string): number {
    const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private filterTutorials(): void {
    this.tutorials = this.unit.tutorials.filter(
      (tutorial) =>
        tutorial.tutorialStream === this.stream || (!tutorial.tutorialStream && !this.stream),
    );
    this.dataSource.data = this.tutorials;
  }

  public saveStream(): void {
    const previousAbbreviation = this.origStreamAbbr;
    this.tutorialStreamService
      .update({abbreviation: previousAbbreviation, unit_id: this.unit.id}, {entity: this.stream})
      .subscribe({
        next: (stream: TutorialStream) => {
          this.stream = stream;
          this.origStreamAbbr = stream.abbreviation;
          this.origName = stream.name;
          this.editingStream = false;
          if (stream.abbreviation !== previousAbbreviation) {
            this.rekeyStream(stream, previousAbbreviation);
          }
          this.alerts.success(`${stream.name} saved`, 2000);
        },
        error: (error: HttpErrorResponse) => {
          this.alerts.error(`Could not save the stream. ${this.errorText(error)}`, 6000);
        },
      });
  }

  /**
   * The unit keeps its streams under their short name. After a rename the old name
   * still pointed at the stream, so deleting it afterwards could not find it and it
   * stayed on the page. The streams are filed again in their order, so the renamed one
   * does not jump to the bottom. A stream with an unsaved rename of its own is left
   * where it is, since the name it is filed under is not known from here, and filing
   * it again would list it twice.
   */
  private rekeyStream(stream: TutorialStream, previousAbbreviation: string): void {
    const cache = this.unit.tutorialStreamsCache;
    const ordered = cache.currentValuesClone();
    cache.delete(previousAbbreviation);
    const refile = ordered.filter((other) => other === stream || cache.get(other.key) === other);
    refile.filter((other) => other !== stream).forEach((other) => cache.delete(other));
    refile.forEach((other) => cache.add(other));
  }

  public setEditStream(value: boolean): void {
    if (!value) {
      this.stream.abbreviation = this.origStreamAbbr;
      this.stream.name = this.origName;
    }
    this.editingStream = value;
  }

  // This method is passed to the submit method on the parent
  // and is only run when an entity is successfully created or updated
  onSuccess(_response: Tutorial, _isNew: boolean): void {
    // A new tutorial reaches the unit's cache before this runs, so reading the list
    // again picks it up once. Pushing it here as well showed it twice.
    this.filterTutorials();
  }

  // Handle the removal of a tutorial
  public deleteTutorial(tutorial: Tutorial): void {
    this.confirmationModal.show(
      `Delete ${tutorial.abbreviation}?`,
      'Students in this tutorial will no longer be enrolled in it. This cannot be undone.',
      () => {
        this.tutorialService.delete(tutorial, this.optionsOnRequest('delete')).subscribe({
          next: () => {
            this.cancelEdit();
            this.filterTutorials();
            this.alerts.success(`${tutorial.abbreviation} deleted`, 2000);
          },
          error: (error) => {
            this.alerts.error(
              `Could not delete ${tutorial.abbreviation}. ${this.errorText(error)}`,
              6000,
            );
          },
        });
      },
      undefined,
      'Delete',
    );
  }

  // This method is called when the form is submitted,
  // which then calls the parent's submit.
  submit(): void {
    super.submit(this.tutorialService, this.alerts, this.onSuccess.bind(this));
  }

  /**
   * The new tutorial is built on the side, not as the selected row. The base form
   * treats a selected row as one being edited, so a create that failed used to leave
   * the add row hidden until the page was reloaded.
   */
  protected formDataToNewObject(_endPointKey: string, _associations?: object): object {
    const tutorial = new Tutorial(this.unit);
    for (const key of Object.keys(this.formData.controls)) {
      tutorial[key] = this.formData.get(key).value;
    }
    tutorial.tutorialStream = this.stream;
    return tutorial;
  }

  // Which campus or tutor the selects show when a row is edited. A tutorial's tutor is
  // a user, so users and campuses both match on id. The user_id form is kept for any
  // older value still shaped that way.
  compareSelection(
    aEntity: User | Campus | {user_id: number} | null,
    bEntity: User | Campus | {user_id: number} | null,
  ): boolean {
    if (!aEntity || !bEntity) {
      return aEntity === bEntity;
    }
    const idOf = (entity: object) =>
      'user_id' in entity ? entity.user_id : (entity as {id?: number}).id;
    return idOf(aEntity) === idOf(bEntity);
  }

  // Handle the deletion of a stream
  deleteStream(): void {
    const stream: TutorialStream = this.stream;

    this.confirmationModal.show(
      `Delete ${stream.name}?`,
      `This deletes the ${stream.abbreviation} stream and every tutorial in it. This cannot be undone.`,
      () =>
        this.unit.deleteStream(stream).subscribe({
          next: (response: boolean) => {
            if (response) {
              this.alerts.success(`${stream.name} deleted`, 4000);
            } else {
              this.alerts.error(`Could not delete ${stream.name}.`, 8000);
            }
          },
          error: (message) => {
            this.alerts.error(`Could not delete ${stream.name}. ${message}`, 8000);
          },
        }),
      undefined,
      'Delete',
    );
  }

  /**
   * Ensure that the unit is passed to the Tutorial entity when create it called.
   */
  protected override optionsOnRequest(
    _kind: 'create' | 'update' | 'delete',
  ): RequestOptions<Tutorial> {
    return {
      constructorParams: this.unit,
      cache: this.unit.tutorialsCache,
    };
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.error ?? error.message;
    }
    return `${error ?? ''}`;
  }
}
