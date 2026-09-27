import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

export type TaskDefinitionSectionId =
  | 'task-details'
  | 'task-learning-outcomes'
  | 'inbox'
  | 'due-dates'
  | 'upload-requirements'
  | 'task-resources'
  | 'prerequisite-tasks'
  | 'discussion-prompts'
  | 'task-assessment-automation'
  | 'scorm-test'
  | 'optional-settings';

export interface TaskDefinitionSection {
  id: TaskDefinitionSectionId;
  label: string;
}

@Component({
  selector: 'f-task-definition-editor',
  templateUrl: 'task-definition-editor.component.html',
  styleUrls: ['task-definition-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionEditorComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() taskDefinition: TaskDefinition;
  @Input() unit: Unit;
  /** Whether the task has edits that Save task would send. */
  @Input() hasChanges: boolean = false;
  /** True while a save of this task is on its way to the server. */
  @Input() saving: boolean = false;

  /** The one save for everything in the sections that do not save on their own. */
  @Output() saveTask: EventEmitter<void> = new EventEmitter();
  @Output() discardChanges: EventEmitter<void> = new EventEmitter();
  @Output() deleteTask: EventEmitter<void> = new EventEmitter();

  @ViewChild('editorHeader') editorHeader?: ElementRef<HTMLElement>;
  @ViewChild('sectionNav') sectionNav?: ElementRef<HTMLElement>;
  @ViewChildren('sectionElement') sectionElements: QueryList<ElementRef<HTMLElement>>;

  public overseerEnabled: boolean = false;
  public activeSectionId: TaskDefinitionSectionId = 'task-details';
  public readonly sectionList: TaskDefinitionSection[] = [
    {id: 'task-details', label: 'Details'},
    {id: 'task-learning-outcomes', label: 'Learning outcomes'},
    {id: 'inbox', label: 'Marking'},
    {id: 'due-dates', label: 'Dates'},
    {id: 'upload-requirements', label: 'Files to submit'},
    {id: 'task-resources', label: 'Task sheet and resources'},
    {id: 'prerequisite-tasks', label: 'Prerequisites'},
    {id: 'discussion-prompts', label: 'Discussion prompts'},
    {id: 'task-assessment-automation', label: 'Automated checks'},
    {id: 'scorm-test', label: 'Online test'},
    {id: 'optional-settings', label: 'Other options'},
  ];

  private sectionElementMap: Map<TaskDefinitionSectionId, HTMLElement> = new Map();
  private sectionChangesSubscription?: Subscription;
  private overseerEnabledSubscription?: Subscription;

  // A click on the section nav scrolls the page smoothly. Until that settles the
  // scroll handler would keep picking whichever section is passing under the
  // header, so it waits.
  private suppressScrollSyncUntil = 0;

  constructor(
    private constants: DoubtfireConstants,
    private host: ElementRef<HTMLElement>,
  ) {}

  public ngOnInit() {
    this.overseerEnabledSubscription = this.constants.IsOverseerEnabled.subscribe((enabled) => {
      this.overseerEnabled = enabled && this.unit.overseerEnabled;
      this.ensureActiveSectionIsVisible();
      this.rebuildSectionElementMap();
    });
  }

  public ngAfterViewInit() {
    this.rebuildSectionElementMap();
    this.sectionChangesSubscription = this.sectionElements.changes.subscribe(() => {
      this.rebuildSectionElementMap();
      this.syncActiveSectionOnScroll();
    });
    queueMicrotask(() => this.syncActiveSectionOnScroll());
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes.taskDefinition && !changes.taskDefinition.firstChange) {
      this.ensureActiveSectionIsVisible();
      this.bringEditorTopIntoView();
      queueMicrotask(() => this.syncActiveSectionOnScroll());
    }
  }

  public ngOnDestroy() {
    this.sectionChangesSubscription?.unsubscribe();
    this.overseerEnabledSubscription?.unsubscribe();
  }

  public get visibleSections(): TaskDefinitionSection[] {
    return this.overseerEnabled
      ? this.sectionList
      : this.sectionList.filter((section) => section.id !== 'task-assessment-automation');
  }

  public sectionLabel(sectionId: TaskDefinitionSectionId): string {
    return this.sectionList.find((section) => section.id === sectionId)?.label ?? '';
  }

  public get statusLabel(): string {
    if (this.saving) {
      return 'Saving...';
    }
    if (this.taskDefinition?.isNew) {
      return 'New task, not saved yet';
    }
    return this.hasChanges ? 'Unsaved changes' : 'All changes saved';
  }

  public save() {
    this.saveTask.emit();
  }

  public scrollToSection(sectionId: TaskDefinitionSectionId) {
    this.activeSectionId = sectionId;

    const target = this.sectionElementMap.get(sectionId);
    if (!target) {
      return;
    }

    // Land the section just below the sticky header rather than under it.
    const top =
      target.getBoundingClientRect().top + window.scrollY - this.stickyHeaderHeight() - 12;
    this.suppressScrollSyncUntil = Date.now() + 800;
    window.scrollTo({top: Math.max(top, 0), behavior: 'smooth'});

    // Move focus with the view, so a keyboard user carries on from the section.
    target.focus({preventScroll: true});
  }

  public syncActiveSectionOnScroll() {
    if (Date.now() < this.suppressScrollSyncUntil) {
      return;
    }

    const sections = this.visibleSections;
    if (!sections.length) {
      return;
    }

    const threshold = this.stickyHeaderHeight() + 24;
    let nextActiveSection = sections[0].id;

    sections.forEach((section) => {
      const sectionElement = this.sectionElementMap.get(section.id);
      if (sectionElement && sectionElement.getBoundingClientRect().top <= threshold) {
        nextActiveSection = section.id;
      }
    });

    // The last sections are too short to reach the header, so once the page is
    // scrolled to the bottom the last one is the one being read.
    const page = document.documentElement;
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= page.scrollHeight - 2) {
      nextActiveSection = sections[sections.length - 1].id;
    }

    if (nextActiveSection !== this.activeSectionId) {
      this.activeSectionId = nextActiveSection;
      this.revealActiveSectionLink();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  public onWindowScroll() {
    this.syncActiveSectionOnScroll();
  }

  private stickyHeaderHeight(): number {
    return this.editorHeader?.nativeElement.getBoundingClientRect().height ?? 0;
  }

  // The section links scroll sideways on narrow screens; keep the current one in
  // sight without moving the page.
  private revealActiveSectionLink() {
    const nav = this.sectionNav?.nativeElement;
    const link = nav?.querySelector<HTMLElement>(`[data-section-link="${this.activeSectionId}"]`);
    if (!nav || !link) {
      return;
    }
    nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
  }

  // Opening another task while scrolled deep into the last one would otherwise
  // leave the new task open somewhere in its middle.
  private bringEditorTopIntoView() {
    const top = this.host.nativeElement.getBoundingClientRect().top;
    if (top < 0) {
      window.scrollTo({top: Math.max(top + window.scrollY - 16, 0)});
    }
  }

  private ensureActiveSectionIsVisible() {
    if (!this.visibleSections.some((section) => section.id === this.activeSectionId)) {
      this.activeSectionId = this.visibleSections[0]?.id ?? 'task-details';
    }
  }

  private rebuildSectionElementMap() {
    this.sectionElementMap.clear();

    this.sectionElements?.forEach((sectionElementRef) => {
      const nativeElement = sectionElementRef.nativeElement;
      const sectionId = nativeElement.getAttribute('data-section-id') as TaskDefinitionSectionId;

      if (sectionId) {
        this.sectionElementMap.set(sectionId, nativeElement);
      }
    });
  }
}
