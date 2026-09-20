import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {InboxDashboardComponent} from './inbox-dashboard.component';

describe('InboxDashboardComponent empty-state colour tokens (THM-M03)', () => {
  let fixture: ComponentFixture<InboxDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxDashboardComponent],
      providers: [
        {provide: FileDownloaderService, useValue: {}},
        {provide: UserService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InboxDashboardComponent);
    // No task input set: renders the "Select a task to review" empty state,
    // the only state reachable without a fully-populated Task/Unit/Project mock.
    fixture.detectChanges();
  });

  it('carries the theme token (not a bare hex) on the empty-state icon and message', () => {
    const icon: HTMLElement = fixture.nativeElement.querySelector('mat-icon');
    const message: HTMLElement = fixture.nativeElement.querySelector('p');

    expect(icon.className).toContain('var(--ot-color-text-muted,#c5c5c5)');
    expect(message.className).toContain('var(--ot-color-text-muted,#c5c5c5)');
    // Regression guard: a plain arbitrary hex class with no token reference
    // would mean the THM-M03 migration was reverted.
    expect(icon.className).not.toMatch(/text-\[#c5c5c5\]/);
  });

  it('shows the expected empty-state copy', () => {
    expect(fixture.nativeElement.textContent).toContain('Select a task to review');
  });
});
