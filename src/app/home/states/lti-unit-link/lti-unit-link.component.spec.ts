import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {Router} from '@angular/router';
import {Subscription, of, throwError} from 'rxjs';
import {CreateNewUnitModal} from 'src/app/admin/modals/create-new-unit-modal/create-new-unit-modal.component';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {LtiService} from 'src/app/api/services/lti.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {LtiUnitLinkComponent} from './lti-unit-link.component';

describe('LtiUnitLinkComponent', () => {
  let fixture: ComponentFixture<LtiUnitLinkComponent>;
  let fetchAll: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // The page scrolls itself on a timer that can fire after a spy is restored, and jsdom
    // has no scrollTo, so stand one in for the whole file.
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    fetchAll = vi.fn(() => throwError(() => 'Server error'));

    await TestBed.configureTestingModule({
      declarations: [LtiUnitLinkComponent],
      imports: [MatButtonModule, MatIconModule],
      providers: [
        {provide: CreateNewUnitModal, useValue: {}},
        {provide: UnitService, useValue: {fetchAll}},
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: (callback: () => void) => {
              callback();
              return new Subscription();
            },
          },
        },
        {provide: ConfirmationModalService, useValue: {show: vi.fn()}},
        {provide: AlertService, useValue: {error: vi.fn(), success: vi.fn()}},
        {provide: LtiService, useValue: {}},
        {provide: UserService, useValue: {currentUser: {ltik: 'x'}}},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    // The logo is an svg icon from the registry, which a spec has no reason to load.
    vi.spyOn(TestBed.inject(MatIconRegistry), 'getNamedSvgIcon').mockReturnValue(
      of(document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
    );

    fixture = TestBed.createComponent(LtiUnitLinkComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A failed request left the page on "Loading..." for good, with no way to try again.
  it('stops loading and offers a retry when the units cannot be fetched', () => {
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('[role="status"]')).toBeNull();
    const alert = page.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Your units could not be loaded.');

    fetchAll.mockReturnValue(of([]));
    (alert?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain('You are not assigned to any');
  });
});
