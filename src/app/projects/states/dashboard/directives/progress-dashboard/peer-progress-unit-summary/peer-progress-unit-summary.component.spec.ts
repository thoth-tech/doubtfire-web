import {beforeEach, describe, expect, it} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {PeerProgressUnitSummary} from 'src/app/api/models/peer-progress-unit-summary';
import {resolvePeerProgressUnitSummaryState} from 'src/app/api/models/peer-progress-unit-summary-state';
import {PeerProgressUnitSummaryComponent} from './peer-progress-unit-summary.component';

describe('PeerProgressUnitSummaryComponent', () => {
  let component: PeerProgressUnitSummaryComponent;
  let fixture: ComponentFixture<PeerProgressUnitSummaryComponent>;

  const baseSummary: PeerProgressUnitSummary = {
    unitId: 123456,
    targetGrade: 3,
    studentPercentage: 65,
    submittedPercentage: 42,
    cohortLabel: 'Anonymous cohort — DUE7 submitted',
    isSuppressed: false,
    isStale: false,
    isFeatureEnabled: true,
    lastUpdatedAt: '2026-08-19T00:00:00.000Z',
    unavailableMessage: '',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PeerProgressUnitSummaryComponent],
      imports: [MatCardModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PeerProgressUnitSummaryComponent);
    component = fixture.componentInstance;
  });

  function render(summary: PeerProgressUnitSummary): string {
    fixture.componentRef.setInput(
      'view',
      resolvePeerProgressUnitSummaryState(false, null, summary),
    );

    fixture.detectChanges();

    return String(fixture.nativeElement.textContent).replace(/\s+/g, ' ').trim();
  }

  it('shows separately labelled student and anonymous cohort progress', () => {
    const text = render(baseSummary);

    expect(component.view.state).toBe('success');
    expect(text).toContain('Your unit completion');
    expect(text).toContain('65%');
    expect(text).toContain('Anonymous cohort — DUE7 submitted');
    expect(text).toContain('42%');

    expect(
      fixture.nativeElement.querySelector('[aria-label="Your unit completion: 65 percent"]'),
    ).toBeTruthy();

    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Anonymous cohort — DUE7 submitted: 42 percent"]',
      ),
    ).toBeTruthy();

    expect(fixture.nativeElement.querySelectorAll('mat-progress-bar')).toHaveLength(2);

    expect(text).not.toContain('123456');
  });

  it('keeps genuine zero progress visible as a real value', () => {
    const text = render({
      ...baseSummary,
      studentPercentage: 0,
      submittedPercentage: 0,
    });

    expect(component.view.state).toBe('no-data');
    expect((text.match(/0%/g) ?? []).length).toBe(2);
    expect(text).not.toContain('Progress unavailable.');
    expect(text).not.toContain('disabled');
  });

  it('does not reveal a cohort percentage when data is suppressed', () => {
    const text = render({
      ...baseSummary,
      submittedPercentage: 91,
      isSuppressed: true,
      unavailableMessage: 'Not enough students to show progress.',
    });

    expect(component.view.state).toBe('hidden');
    expect(component.view.data?.studentPercentage).toBe(65);
    expect(component.view.data?.submittedPercentage).toBeNull();

    expect(text).toContain('65%');
    expect(text).toContain('Not enough students to show progress.');
    expect(text).not.toContain('91%');
  });

  it('keeps unavailable cohort data separate from student progress', () => {
    const text = render({
      ...baseSummary,
      submittedPercentage: null,
      unavailableMessage: 'Progress unavailable.',
    });

    expect(component.view.state).toBe('unavailable');
    expect(text).toContain('65%');
    expect(text).toContain('Progress unavailable.');

    expect(fixture.nativeElement.querySelectorAll('mat-progress-bar')).toHaveLength(1);
  });

  it('does not render percentages when the feature is disabled', () => {
    const text = render({
      ...baseSummary,
      isFeatureEnabled: false,
      unavailableMessage: 'Peer Progress Indicator is disabled for this unit.',
    });

    expect(component.view.state).toBe('disabled');
    expect(component.view.data?.studentPercentage).toBeNull();
    expect(component.view.data?.submittedPercentage).toBeNull();

    expect(text).toContain('Peer Progress Indicator is disabled for this unit.');
    expect(text).not.toContain('%');
  });

  it('keeps stale cohort information privacy safe', () => {
    const text = render({
      ...baseSummary,
      submittedPercentage: 88,
      isStale: true,
      unavailableMessage: 'Peer progress is currently unavailable.',
    });

    expect(component.view.state).toBe('stale');
    expect(component.view.data?.studentPercentage).toBe(65);
    expect(component.view.data?.submittedPercentage).toBeNull();

    expect(text).toContain('65%');
    expect(text).toContain('Peer progress is currently unavailable.');
    expect(text).not.toContain('88%');
  });

  it('updates when its typed input changes', () => {
    let text = render(baseSummary);

    expect(text).toContain('65%');
    expect(text).toContain('42%');

    text = render({
      ...baseSummary,
      studentPercentage: 80,
      submittedPercentage: 50,
    });

    expect(text).toContain('80%');
    expect(text).toContain('50%');
    expect(text).not.toContain('65%');
    expect(text).not.toContain('42%');
  });
});
