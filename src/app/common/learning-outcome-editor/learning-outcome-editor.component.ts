import {LiveAnnouncer} from '@angular/cdk/a11y';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  computed,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import {MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatTable, MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {
  FeedbackTemplateService,
  LearningOutcome,
  LearningOutcomeService,
  TaskDefinition,
  TaskService,
  Unit,
} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import API_URL from 'src/app/config/constants/apiUrl';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {ConfirmationModalService} from '../modals/confirmation-modal/confirmation-modal.service';
import {
  CsvResult,
  CsvResultModalService,
} from '../modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from '../modals/csv-upload-modal/csv-upload-modal.service';
import {NestedCsvDownloadModalService} from './nested-csv-download-modal/nested-csv-download-modal.service';

interface OutcomeSnapshot {
  abbreviation: string;
  shortDescription: string;
  fullOutcomeDescription: string;
  linkedOutcomeIds: number[];
}

let nextEditorId = 0;

@Component({
  selector: 'f-learning-outcome-editor',
  templateUrl: 'learning-outcome-editor.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LearningOutcomeEditorComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input() context?: TaskDefinition | Unit;

  @ViewChild('outcomeTable', {static: false}) outcomeTable: MatTable<LearningOutcome>;
  @ViewChild(MatSort, {static: false}) outcomeSort: MatSort;
  @ViewChild(MatPaginator, {static: false}) outcomePaginator: MatPaginator;

  /** Keeps the field ids apart when more than one editor is on the page. */
  public readonly idPrefix = `learning-outcome-editor-${nextEditorId++}`;

  public outcomeSource: MatTableDataSource<LearningOutcome> = new MatTableDataSource([]);
  public outcomeColumns: string[] = [
    'abbreviation',
    'shortDescription',
    'fullOutcomeDescription',
    'connectedOutcomes',
    'learningOutcomeAction',
  ];
  public selectedOutcome: LearningOutcome;
  public abbreviationPrefix: 'TLO' | 'ULO' | 'GLO';

  /**
   * The outcomes this one can be connected to. They come from two caches that each
   * report every change in full, so each is kept on its own and the two are joined,
   * rather than appended to one list, which filled the suggestions with repeats.
   */
  private readonly institutionOutcomes = signal<LearningOutcome[]>([]);
  private readonly unitOutcomes = signal<LearningOutcome[]>([]);
  public readonly allOutcomes = computed(() => [
    ...this.institutionOutcomes(),
    ...this.unitOutcomes(),
  ]);
  public selectedConnectedOutcomes = signal([]);

  private subscriptions: Subscription[] = [];
  private snapshot: OutcomeSnapshot | null = null;

  constructor(
    private alerts: AlertService,
    private learningOutcomeService: LearningOutcomeService,
    private fileDownloaderService: FileDownloaderService,
    private nestedCsvDownloadModalService: NestedCsvDownloadModalService,
    private feedbackTemplateService: FeedbackTemplateService,
    private taskService: TaskService,
    private csvResultModalService: CsvResultModalService,
    private csvUploadModal: CsvUploadModalService,
    private confirmationModal: ConfirmationModalService,
  ) {
    this.outcomeSource.filterPredicate = (data: LearningOutcome, filter: string) => {
      const filterValue = filter.trim().toLowerCase();
      return [data.abbreviation, data.shortDescription, data.fullOutcomeDescription].some((text) =>
        (text ?? '').toLowerCase().includes(filterValue),
      );
    };
    this.outcomeSource.sortingDataAccessor = (data: LearningOutcome, column: string) =>
      (data[column] ?? '').toString().toLowerCase();

    effect(() => {
      const linkedOutcomes = this.selectedConnectedOutcomes().map((outcome) => outcome.id);
      if (
        this.selectedOutcome &&
        !this.sameIds(linkedOutcomes, this.selectedOutcome.linkedOutcomeIds ?? [])
      ) {
        this.selectedOutcome.linkedOutcomeIds = linkedOutcomes;
      }
    });
  }

  private sameIds(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const sortedLeft = [...left].sort((a, b) => a - b);
    const sortedRight = [...right].sort((a, b) => a - b);
    return sortedLeft.every((id, index) => id === sortedRight[index]);
  }

  ngOnInit(): void {
    this.subscribeToLearningOutcomes();
  }

  ngAfterViewInit(): void {
    this.outcomeSource.paginator = this.outcomePaginator;
    this.outcomeSource.sort = this.outcomeSort;
  }

  private subscribeToLearningOutcomes(): void {
    this.setAbbreviationPrefix();
    this.institutionOutcomes.set([]);
    this.unitOutcomes.set([]);

    if (!this.context) {
      this.subscriptions.push(
        this.learningOutcomeService.cache.values.subscribe((outcomes) => {
          const glos = outcomes.filter((outcome) => outcome.contextType === null);
          this.outcomeSource.data = glos;
        }),
      );
      return;
    }

    this.subscriptions.push(
      this.context.learningOutcomesCache.values.subscribe((learningOutcomes) => {
        this.outcomeSource.data = learningOutcomes;
      }),
    );

    this.subscriptions.push(
      this.learningOutcomeService.cache.values.subscribe((outcomes) => {
        this.institutionOutcomes.set(outcomes.filter((outcome) => outcome.contextType === null));
      }),
    );

    if (this.context instanceof TaskDefinition) {
      this.subscriptions.push(
        this.context.unit.learningOutcomesCache.values.subscribe((learningOutcomes) => {
          this.unitOutcomes.set(learningOutcomes);
        }),
      );
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.setAbbreviationPrefix();
    this.closeEditor();

    // The task editor keeps this editor on screen and swaps the task under it. Without
    // following the new task, the table kept listing the outcomes of the one before.
    if (changes.context && !changes.context.firstChange) {
      this.unsubscribeAll();
      this.subscribeToLearningOutcomes();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAll();
  }

  private unsubscribeAll(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
  }

  setAbbreviationPrefix(): void {
    if (!this.context) {
      this.abbreviationPrefix = 'GLO';
    } else if (this.context instanceof TaskDefinition) {
      this.abbreviationPrefix = 'TLO';
    } else if (this.context instanceof Unit) {
      this.abbreviationPrefix = 'ULO';
    }
  }

  public saveLearningOutcome(learningOutcome: LearningOutcome) {
    if (
      !learningOutcome.abbreviation?.trim() ||
      !learningOutcome.shortDescription?.trim() ||
      !learningOutcome.fullOutcomeDescription?.trim()
    ) {
      this.alerts.error('Fill in the code, the short description and the full outcome first.');
      return;
    }
    learningOutcome.save().subscribe({
      next: () => {
        this.alerts.success(`${learningOutcome.abbreviation} saved`);
        learningOutcome.setOriginalSaveData(this.learningOutcomeService.mapping);
        // Saving from a row leaves whatever else is open alone.
        if (this.selectedOutcome === learningOutcome) {
          this.closeEditor();
        }
      },
      error: () => this.alerts.error('Could not save the learning outcome. Please try again.'),
    });
  }

  public selectLearningOutcome(learningOutcome: LearningOutcome) {
    if (this.selectedOutcome === learningOutcome) {
      this.closeEditor();
    } else {
      this.selectedOutcome = learningOutcome;
      this.snapshot = this.snapshotOf(learningOutcome);
      this.selectedConnectedOutcomes.set(this.getLinkedOutcomes(learningOutcome));
      if (!this.selectedOutcome.context) {
        this.selectedOutcome.context = this.context;
      }

      if (!this.selectedOutcome.hasOriginalSaveData) {
        this.selectedOutcome.setOriginalSaveData(this.learningOutcomeService.mapping);
      }
    }
  }

  /**
   * Put the open outcome back as it was when it was opened, and close it. A new outcome
   * that was never saved is simply dropped.
   */
  public cancelEdit(): void {
    if (this.selectedOutcome && this.snapshot) {
      Object.assign(this.selectedOutcome, this.snapshot);
    }
    this.closeEditor();
  }

  private closeEditor(): void {
    this.selectedOutcome = null;
    this.snapshot = null;
    this.selectedConnectedOutcomes.set([]);
  }

  private snapshotOf(outcome: LearningOutcome): OutcomeSnapshot {
    return {
      abbreviation: outcome.abbreviation,
      shortDescription: outcome.shortDescription,
      fullOutcomeDescription: outcome.fullOutcomeDescription,
      linkedOutcomeIds: [...(outcome.linkedOutcomeIds ?? [])],
    };
  }

  applyFilter(filterValue: string) {
    this.outcomeSource.filter = filterValue.trim().toLowerCase();
    if (this.outcomeSource.paginator) {
      this.outcomeSource.paginator.firstPage();
    }
  }

  public get filtering(): boolean {
    return !!this.outcomeSource.filter;
  }

  public learningOutcomeHasChanges(learningOutcome: LearningOutcome): boolean {
    return learningOutcome.hasChanges(this.learningOutcomeService.mapping);
  }

  public deleteLearningOutcome(learningOutcome: LearningOutcome) {
    this.confirmationModal.show(
      `Delete ${learningOutcome.abbreviation}?`,
      'The outcome and its links to tasks go for good. This cannot be undone.',
      () => {
        learningOutcome.delete().subscribe({
          next: () => {
            this.alerts.success(`${learningOutcome.abbreviation} deleted`);
            if (this.selectedOutcome === learningOutcome) {
              this.closeEditor();
            }
          },
          error: () =>
            this.alerts.error('Could not delete the learning outcome. Please try again.'),
        });
      },
      undefined,
      'Delete',
    );
  }

  public uploadCsv(type: 'Learning Outcomes' | 'Feedback Templates') {
    let url: string;

    if (type === 'Learning Outcomes') {
      if (!this.context) {
        return;
      }
      url = this.context.getOutcomeBatchUploadUrl();
    } else {
      if (this.context) {
        url = this.context.getFeedbackTemplateBatchUploadUrl();
      } else {
        url = `${API_URL}/global/feedback_chips/csv`;
      }
    }

    const what = type === 'Learning Outcomes' ? 'learning outcomes' : 'feedback comments';
    this.csvUploadModal.show(
      `Upload ${what}`,
      `Upload a CSV of ${what}. Download the current list first to see the columns it needs.`,
      {file: {name: `${type} CSV Data`, type: 'csv'}},
      url,
      (response: CsvResult) => {
        this.csvResultModalService.show(`${type} CSV Upload Results`, response);
        if (response.success.length > 0) {
          let contextType: 'units' | 'task_definitions';
          if (this.context instanceof Unit) {
            this.context.refresh();
            contextType = 'units';
          } else if (this.context instanceof TaskDefinition) {
            this.context.unit.refresh();
            contextType = 'task_definitions';
          }
          if (type === 'Feedback Templates' && contextType) {
            this.feedbackTemplateService
              .fetchAll({contextType, contextId: this.context.id}, {})
              .subscribe({
                error: () => this.alerts.error('Error loading task feedback templates.'),
              });
          }
        }
      },
    );
  }

  public downloadCsv(type: 'Learning Outcomes' | 'Feedback Templates') {
    let url: string;

    if (type === 'Learning Outcomes') {
      if (!this.context) {
        return;
      }
      url = this.context.getOutcomeBatchUploadUrl();
    } else {
      if (this.context) {
        url = this.context.getFeedbackTemplateBatchUploadUrl();
      } else {
        url = `${API_URL}/global/feedback_chips/csv`;
      }
    }

    let name = `${type}.csv`;

    if (this.context instanceof TaskDefinition) {
      name = `${this.context.unit.code}-${this.context.abbreviation}-${name}`;
    } else if (this.context instanceof Unit) {
      name = `${this.context.code}-${name}`;
    }

    if (this.context instanceof Unit) {
      this.nestedCsvDownloadModalService.show(url, name, type);
    } else {
      this.fileDownloaderService.downloadFile(url, name);
    }
  }

  public createLearningOutcome() {
    const learningOutcome = new LearningOutcome();

    if (this.context) {
      learningOutcome.context = this.context;
      if (this.context instanceof TaskDefinition) {
        learningOutcome.contextType = 'TaskDefinition';
      } else if (this.context instanceof Unit) {
        learningOutcome.contextType = 'Unit';
      }
      learningOutcome.contextId = this.context.id;
    }
    learningOutcome.abbreviation = this.abbreviationPrefix + String(this.getNextOutcomeNumber());
    learningOutcome.shortDescription = '';
    learningOutcome.fullOutcomeDescription = '';
    this.selectedConnectedOutcomes.set([]);

    this.selectedOutcome = learningOutcome;
    this.snapshot = null;
  }

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  readonly typedConnectedOutcome = model('');
  readonly filteredOutcomes = computed(() => {
    const currentOutcome = this.typedConnectedOutcome().toLowerCase();
    return this.allOutcomes().filter((outcome) => {
      const abbreviation = outcome.abbreviation?.toLowerCase();
      return (
        !this.selectedConnectedOutcomes().includes(outcome) &&
        (!currentOutcome || abbreviation?.includes(currentOutcome))
      );
    });
  });

  readonly announcer = inject(LiveAnnouncer);

  add(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      const outcome = this.allOutcomes().find(
        (o) => o.abbreviation?.toLowerCase() === value.toLowerCase(),
      );
      if (outcome && !this.selectedConnectedOutcomes().includes(outcome)) {
        this.selectedConnectedOutcomes.update((selectedConnectedOutcomes) => [
          ...selectedConnectedOutcomes,
          outcome,
        ]);
      }
    }

    this.typedConnectedOutcome.set('');
  }

  remove(outcome: LearningOutcome): void {
    this.selectedConnectedOutcomes.update((selectedConnectedOutcomes) => {
      const updatedOutcomes = selectedConnectedOutcomes.filter(
        (o) => o.abbreviation !== outcome.abbreviation,
      );
      this.announcer.announce(`Removed ${outcome.abbreviation}`);
      return updatedOutcomes;
    });
  }

  select(event: MatAutocompleteSelectedEvent): void {
    const outcome = this.allOutcomes().find((o) => o.abbreviation === event.option.value);

    if (outcome && !this.selectedConnectedOutcomes().includes(outcome)) {
      this.selectedConnectedOutcomes.update((selectedConnectedOutcomes) => [
        ...selectedConnectedOutcomes,
        outcome,
      ]);
    }

    this.typedConnectedOutcome.set('');
    event.option.deselect();
  }

  getLinkedOutcomes(learningOutcome: LearningOutcome): LearningOutcome[] {
    const linked = learningOutcome.linkedOutcomeIds ?? [];
    return this.allOutcomes().filter((outcome) => linked.includes(outcome.id));
  }

  /**
   * The number for a new outcome's code: one more than the highest already used with
   * this prefix. It used to read the last row of the table, which gave "ULONaN" when
   * that row's code did not end in a number, or a repeat once the table was sorted.
   */
  getNextOutcomeNumber(): number {
    const numbers = (this.outcomeSource.data ?? [])
      .map((outcome) => outcome.abbreviation ?? '')
      .filter((abbreviation) => abbreviation.startsWith(this.abbreviationPrefix))
      .map((abbreviation) => abbreviation.slice(this.abbreviationPrefix.length))
      .filter((suffix) => /^\d+$/.test(suffix))
      .map((suffix) => Number(suffix));

    if (numbers.length > 0) {
      return Math.max(...numbers) + 1;
    }
    return 1;
  }
}
