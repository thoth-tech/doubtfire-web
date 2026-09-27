import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {Router} from '@angular/router';
import {Subscription, of, throwError} from 'rxjs';
import {ProjectService} from 'src/app/api/models/doubtfire-model';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {LtiService} from 'src/app/api/services/lti.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {LtiDashboardComponent} from './lti-dashboard.component';

describe('LtiDashboardComponent', () => {
  let fixture: ComponentFixture<LtiDashboardComponent>;
  let component: LtiDashboardComponent;
  let ltiService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // The page scrolls itself on a timer that can fire after a spy is restored, and jsdom
    // has no scrollTo, so stand one in for the whole file.
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    ltiService = {
      getUnitLink: vi.fn(() => of({unitId: 7})),
      enrolUser: vi.fn(() => of(null)),
      syncStudentsGrades: vi.fn(() => throwError(() => 'LMS is down')),
      removeUnitLink: vi.fn(() => throwError(() => 'Not allowed')),
    };

    await TestBed.configureTestingModule({
      declarations: [LtiDashboardComponent],
      imports: [MatButtonModule, MatIconModule],
      providers: [
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {provide: LtiService, useValue: ltiService},
        {provide: UserService, useValue: {currentUser: {systemRole: 'Convenor', ltik: 'x'}}},
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: (callback: () => void) => {
              callback();
              return new Subscription();
            },
          },
        },
        {provide: AlertService, useValue: {error: vi.fn(), success: vi.fn()}},
        {provide: UnitService, useValue: {get: vi.fn(() => of({id: 7, code: 'SIT374'}))}},
        {provide: ProjectService, useValue: {}},
        // Run the confirm step straight away, as if the convenor pressed yes.
        {
          provide: ConfirmationModalService,
          useValue: {show: (...args: unknown[]) => (args[2] as () => void)()},
        },
        {provide: CsvResultModalService, useValue: {show: vi.fn()}},
        {provide: SidekiqProgressModalService, useValue: {show: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    // The logo is an svg icon from the registry, which a spec has no reason to load.
    vi.spyOn(TestBed.inject(MatIconRegistry), 'getNamedSvgIcon').mockReturnValue(
      of(document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
    );

    fixture = TestBed.createComponent(LtiDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function button(label: string): HTMLButtonElement {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (candidate) => candidate.textContent.includes(label),
    ) as HTMLButtonElement;
  }

  // Both sync buttons were round icons with aria-label="", so they had no name at all.
  it('names both sync actions in words', () => {
    expect(button('Sync enrolments')).toBeTruthy();
    expect(button('Sync grades')).toBeTruthy();
  });

  // A failed grade sync set the syncing flag back to true, so both buttons stayed
  // disabled and spinning until the page was reloaded.
  it('lets the convenor try again after a grade sync fails', () => {
    component.syncStudentsGrades();
    fixture.detectChanges();

    expect(component.isSyncingGrades).toBe(false);
    expect(button('Sync grades').disabled).toBe(false);
  });

  it('shows the message from a failed unlink instead of undefined', () => {
    const alerts = TestBed.inject(AlertService) as unknown as {error: ReturnType<typeof vi.fn>};

    component.removeLink();

    expect(alerts.error).toHaveBeenCalledWith('Failed to unlink the unit: Not allowed', 6000);
  });
});
