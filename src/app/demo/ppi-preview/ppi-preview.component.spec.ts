import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {PeerProgressDisplayPreferenceService} from 'src/app/common/services/peer-progress-display-preference.service';
import {PpiPreviewComponent} from './ppi-preview.component';

describe('PpiPreviewComponent', () => {
  let fixture: ComponentFixture<PpiPreviewComponent>;
  let preference: {enabled: boolean; setEnabled: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    preference = {
      enabled: false,
      setEnabled: vi.fn((enabled: boolean) => {
        preference.enabled = enabled;
        return enabled;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [PpiPreviewComponent, NoopAnimationsModule],
      providers: [{provide: PeerProgressDisplayPreferenceService, useValue: preference}],
    }).compileComponents();

    fixture = TestBed.createComponent(PpiPreviewComponent);
    fixture.detectChanges();
  });

  function text(): string {
    return String(fixture.nativeElement.textContent).replace(/\s+/g, ' ').trim();
  }

  it('updates headline, compact metrics, total and explanatory copy together', () => {
    fixture.componentInstance.setAdvanced(true);
    fixture.componentInstance.select('rounded-90');
    fixture.detectChanges();

    expect(fixture.componentInstance.summaryPercentage).toBe(20);
    expect(fixture.componentInstance.data.completedPercentage).toBe(20);
    expect(fixture.componentInstance.data.submittedPercentage).toBe(50);
    expect(text()).toContain('statuses total 90%');
    expect(text()).toContain('50% submitted and 20% complete');

    fixture.componentInstance.select('rounded-110');
    fixture.detectChanges();

    expect(fixture.componentInstance.summaryPercentage).toBe(30);
    expect(fixture.componentInstance.data.completedPercentage).toBe(30);
    expect(fixture.componentInstance.data.submittedPercentage).toBe(80);
    expect(text()).toContain('statuses total 110%');
  });

  it('shows all seven canonical Batch 09 statuses in the full preview', () => {
    fixture.componentInstance.setAdvanced(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.ppi-preview__statuses li')).toHaveLength(7);
    expect(text()).toContain('Not Started');
    expect(text()).toContain('Working On It');
    expect(text()).toContain('Ready for Feedback');
    expect(text()).toContain('Resubmit');
    expect(text()).toContain('Redo');
    expect(text()).toContain('Complete');
    expect(text()).toContain('Fail');
  });

  it('keeps Advanced on across preview changes and stores the user choice', () => {
    fixture.componentInstance.setAdvanced(true);
    fixture.componentInstance.select('rounded-90');
    fixture.componentInstance.select('details-protected');
    fixture.detectChanges();

    expect(fixture.componentInstance.advanced).toBe(true);
    expect(preference.setEnabled).toHaveBeenCalledWith(true);
    expect(fixture.nativeElement.querySelector('#ppi-preview-advanced')).toBeTruthy();
  });

  it('never exposes compact or detailed values for an insufficient cohort', () => {
    fixture.componentInstance.setAdvanced(true);
    fixture.componentInstance.select('insufficient');
    fixture.detectChanges();

    expect(text()).toContain('Progress is hidden to protect privacy');
    expect(text()).not.toContain('Completed 10%');
    expect(text()).not.toContain('Submitted 60%');
    expect(fixture.nativeElement.querySelector('[role="switch"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ppi-preview__statuses')).toBeNull();
  });

  it('uses selected-state styling without a permanent active-state class', () => {
    const choice = fixture.nativeElement.querySelector('[data-testid="ppi-preview-full"]');

    expect(choice.getAttribute('aria-pressed')).toBe('true');
    expect(choice.classList.contains('active')).toBe(false);
  });

  it('uses native keyboard-operable buttons and exposes exactly one selected state', () => {
    const choices = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.ppi-preview__choices button'),
    );

    expect(choices).toHaveLength(5);
    expect(choices.every((choice) => choice.tagName === 'BUTTON' && choice.type === 'button')).toBe(
      true,
    );
    expect(choices.filter((choice) => choice.getAttribute('aria-pressed') === 'true')).toHaveLength(
      1,
    );

    fixture.componentInstance.select('rounded-110');
    fixture.detectChanges();

    expect(
      choices.filter((choice) => choice.getAttribute('aria-pressed') === 'true')[0]?.dataset.testid,
    ).toBe('ppi-preview-rounded-110');
  });
});
