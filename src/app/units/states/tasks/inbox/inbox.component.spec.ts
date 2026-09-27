import {HotkeysService} from '@ngneat/hotkeys';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver} from '@angular/cdk/layout';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {Router} from '@angular/router';
import {EMPTY} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {InboxComponent} from './inbox.component';

const selectedTaskServiceStub = {
  currentPdfUrl$: EMPTY,
  selectedTask$: EMPTY,
};
const hotkeysServiceStub = {
  getHotkeys: () => [],
  addShortcut: () => EMPTY,
  registerHelpModal: () => {},
  removeShortcuts: () => {},
};
const emptyProvider = {};

/** jsdom ships no ResizeObserver, so stand one in and deliver its entries by hand. */
class FakeResizeObserver {
  public static last: FakeResizeObserver | null = null;
  public readonly observed: Element[] = [];
  public disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }

  public observe(element: Element): void {
    this.observed.push(element);
  }

  public unobserve(): void {}

  public disconnect(): void {
    this.disconnected = true;
  }

  public report(width: number): void {
    const entries = [{contentRect: {width}} as ResizeObserverEntry];
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

describe('InboxComponent', () => {
  let component: InboxComponent;
  let fixture: ComponentFixture<InboxComponent>;

  // The real template branches on a breakpoint and pulls in the whole task list, so each
  // test sets the smallest markup that carries the ref and the binding it is about.
  const create = async (template = '') => {
    await TestBed.configureTestingModule({
      declarations: [InboxComponent],
      providers: [
        {provide: HotkeysService, useValue: hotkeysServiceStub},
        {provide: SelectedTaskService, useValue: selectedTaskServiceStub},
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: Router, useValue: emptyProvider},
        {provide: MatDialog, useValue: emptyProvider},
        {provide: UserService, useValue: emptyProvider},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: BreakpointObserver, useValue: {observe: () => EMPTY, isMatched: () => false}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(InboxComponent, {set: {template}})
      .compileComponents();

    fixture = TestBed.createComponent(InboxComponent);
    component = fixture.componentInstance;
  };

  beforeEach(() => {
    FakeResizeObserver.last = null;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    await create();
    expect(component).toBeTruthy();
  });

  it('never measures the task list panel while Angular is checking it', async () => {
    await create('<div #inboxpanel></div><df-staff-task-list [isNarrow]="narrowTaskInbox" />');
    const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect');

    // Measuring from the binding forced a reflow every check, and the list it feeds could
    // change the answer between the check and the pass that verifies it, which is NG0100.
    expect(() => fixture.detectChanges()).not.toThrow();
    fixture.detectChanges();

    expect(measure).not.toHaveBeenCalled();
  });

  it('takes the narrow list layout from a resize, and lets the observer go on destroy', async () => {
    await create('<div #inboxpanel></div><df-staff-task-list [isNarrow]="narrowTaskInbox" />');
    fixture.detectChanges();

    const observer = FakeResizeObserver.last;
    expect(observer.observed).toEqual([fixture.nativeElement.querySelector('div')]);
    expect(component.narrowTaskInbox).toBe(false);

    observer.report(44);
    fixture.detectChanges();
    expect(component.narrowTaskInbox).toBe(true);

    observer.report(350);
    fixture.detectChanges();
    expect(component.narrowTaskInbox).toBe(false);

    fixture.destroy();
    expect(observer.disconnected).toBe(true);
  });
});
