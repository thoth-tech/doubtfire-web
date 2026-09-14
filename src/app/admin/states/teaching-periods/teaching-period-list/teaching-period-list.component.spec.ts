import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {of} from 'rxjs';
import {TeachingPeriodService} from 'src/app/api/services/teaching-period.service';
import {TeachingPeriodUnitImportService} from '../teaching-period-unit-import/teaching-period-unit-import.dialog';
import {
  NewTeachingPeriodDialogComponent,
  TeachingPeriodListComponent,
} from './teaching-period-list.component';

const emptyProvider = {};

describe('TeachingPeriodListComponent', () => {
  let component: TeachingPeriodListComponent;
  let fixture: ComponentFixture<TeachingPeriodListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeachingPeriodListComponent],
      providers: [
        {provide: TeachingPeriodService, useValue: emptyProvider},
        {provide: MatDialog, useValue: emptyProvider},
        {provide: TeachingPeriodUnitImportService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TeachingPeriodListComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeachingPeriodListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('NewTeachingPeriodDialogComponent deleteBreak feedback', () => {
  it('confirms to the user when a break is removed', () => {
    const alertService = {success: vi.fn(), error: vi.fn()};
    const component = Object.create(NewTeachingPeriodDialogComponent.prototype) as {
      alertService: typeof alertService;
      deleteBreak(teachingPeriod: unknown, teachingBreak: unknown): void;
    };
    component.alertService = alertService;
    const teachingPeriod = {removeBreak: vi.fn(() => of({}))};

    component.deleteBreak(teachingPeriod, {id: 3});

    expect(teachingPeriod.removeBreak).toHaveBeenCalledWith(3);
    expect(alertService.success).toHaveBeenCalledWith('Break removed', 2000);
  });
});
