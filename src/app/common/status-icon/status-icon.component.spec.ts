import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {StatusIconComponent} from './status-icon.component';

describe('StatusIconComponent', () => {
  let component: StatusIconComponent;
  let fixture: ComponentFixture<StatusIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusIconComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(StatusIconComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatusIconComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('StatusIconComponent accessible name (A11Y-COLOUR01)', () => {
  let fixture: ComponentFixture<StatusIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusIconComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusIconComponent);
  });

  function wrapperEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.status-chip');
  }

  it('exposes the status as an accessible name for two different statuses', () => {
    fixture.componentInstance.status = 'complete';
    fixture.detectChanges();
    expect(wrapperEl().getAttribute('role')).toBe('img');
    expect(wrapperEl().getAttribute('aria-label')).toBe(fixture.componentInstance.statusLabel);
    expect(wrapperEl().getAttribute('aria-label')).toBe('Complete');

    fixture.componentInstance.status = 'need_help';
    fixture.detectChanges();
    expect(wrapperEl().getAttribute('aria-label')).toBe(fixture.componentInstance.statusLabel);
    expect(wrapperEl().getAttribute('aria-label')).toBe('Need Help');
  });

  it('hides the icon glyph from assistive tech so the name is never announced twice', () => {
    fixture.componentInstance.status = 'complete';
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('still exposes an accessible name for an unrecognised status, via the not_started fallback', () => {
    // resolvedStatus falls back to 'not_started' for any value outside STATUS_KEYS.
    fixture.componentInstance.status = 'this-is-not-a-real-status' as never;
    fixture.detectChanges();
    expect(wrapperEl().getAttribute('aria-label')).toBe('Not Started');
    expect(wrapperEl().getAttribute('role')).toBe('img');
  });
});
