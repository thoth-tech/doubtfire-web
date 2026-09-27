import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {from} from 'rxjs';
import {TiiActionService} from 'src/app/api/services/tii-action.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {TiiActionLogComponent} from './tii-action-log.component';

const emptyProvider = {};

describe('TiiActionLogComponent', () => {
  let component: TiiActionLogComponent;
  let fixture: ComponentFixture<TiiActionLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TiiActionLogComponent],
      providers: [
        {provide: TiiActionService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TiiActionLogComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TiiActionLogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('TiiActionLogComponent sticky columns (STAFF-15)', () => {
  let fixture: ComponentFixture<TiiActionLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TiiActionLogComponent],
      imports: [FormsModule, MatSortModule, MatTableModule],
      providers: [
        // A Promise-backed observable defers emission to a microtask, same as
        // the real HTTP call would - avoids mutating tiiActionsSource inside
        // the same synchronous pass ngAfterViewInit runs in.
        {provide: TiiActionService, useValue: {query: () => from(Promise.resolve([]))}},
        {provide: AlertService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TiiActionLogComponent);
    fixture.detectChanges(); // triggers ngAfterViewInit, which subscribes
    await fixture.whenStable(); // let the microtask set tiiActionsSource
    fixture.detectChanges(); // render the table against that data source
  });

  // CDK Table applies `position: sticky` via the mat-mdc-table-sticky class (in its
  // stylesheet, not inline) and sets the per-instance left/right offset inline. It
  // never renders errorCode or complete at all - they're declared in the template
  // but absent from the `columns` array, so they don't reach the header row.
  function headerCell(column: string): HTMLElement {
    return fixture.nativeElement.querySelector(`.mat-column-${column}`);
  }

  it('only pins the identifying column (type) to the start', () => {
    const type = headerCell('type');
    expect(type.classList.contains('mat-mdc-table-sticky')).toBe(true);
    expect(type.style.left).toBe('0px');
    expect(type.style.right).toBe('');

    for (const column of ['lastRun', 'retries', 'retry', 'errorMessage']) {
      const cell = headerCell(column);
      expect(
        cell.classList.contains('mat-mdc-table-sticky'),
        `${column} should not be sticky`,
      ).toBe(false);
      expect(cell.style.left, `${column} should have no sticky offset`).toBe('');
    }
  });

  it('pins the tools column to the end, not the start, matching the tutorials table', () => {
    const tools = headerCell('tiiActionTools');
    expect(tools.classList.contains('mat-mdc-table-sticky')).toBe(true);
    expect(tools.style.right).toBe('0px');
    expect(tools.style.left).toBe('');
  });
});
