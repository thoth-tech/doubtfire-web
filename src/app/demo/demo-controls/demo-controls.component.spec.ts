import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {PeerProgressDisplayPreferenceService} from 'src/app/common/services/peer-progress-display-preference.service';
import {DemoMeetingLinksStore} from '../demo-meeting-links.store';
import {DemoModeStore} from '../demo-mode.store';
import {DemoScenarioContract, DemoScenarioRegistryService} from '../demo-scenario-registry.service';
import {DemoToolsModule} from '../demo-tools.module';
import {DemoControlsComponent} from './demo-controls.component';

const scenario: DemoScenarioContract = {
  schema_version: 1,
  scenario_id: 'mobile-feedback-v1',
  demo_only: true,
  generated_at: '2026-08-31T00:00:00Z',
  primary_unit_key: 'DEMO10001',
  units: [
    {
      key: 'DEMO10001',
      code: 'DEMO10001',
      name: 'Foundations',
      unit_id: 11,
      project_id: 21,
      ppi: {
        state: 'available',
        unavailable_reason: null,
        task_abbreviation: 'DUE7',
        task_definition_id: 31,
        submitted_percentage: 60,
        completed_percentage: 10,
        status_distribution: [],
      },
    },
    {
      key: 'DEMO30243',
      code: 'DEMO30243',
      name: 'Professional Practice',
      unit_id: 12,
      project_id: 22,
      ppi: {
        state: 'unavailable',
        unavailable_reason: 'insufficient_cohort',
        task_abbreviation: 'DUE7',
        task_definition_id: 32,
        submitted_percentage: null,
        completed_percentage: null,
        status_distribution: null,
      },
    },
  ],
  task_lifecycle: {
    unit_key: 'DEMO10001',
    total_tasks: 10,
    submitted_percentage: 60,
    completed_percentage: 10,
    statuses: [
      {
        status: 'not_started',
        count: 2,
        percentage: 20,
        task_abbreviations: ['FUTURE', 'OVERDUE'],
      },
      {
        status: 'working_on_it',
        count: 2,
        percentage: 20,
        task_abbreviations: ['DUE3', 'WORK'],
      },
    ],
  },
  notification_hooks: Array.from({length: 7}, (_, index) => ({
    key: 'event-' + index,
    id: index + 1,
    event: 'event_' + index,
    notification_type: 'task',
    read: index > 3,
    created_at: '2026-08-31T00:00:00Z',
    link: '/notifications',
  })),
  group_hook: {
    key: 'project-team',
    unit_key: 'DEMO20007',
    unit_id: 12,
    project_id: 22,
    group_set_id: 32,
    group_id: 42,
    name: 'Team Indigo',
    member_count: 3,
    capacity: 4,
    route: '/projects/22/groups',
  },
  walkthrough_links: [
    {key: 'tasks', label: 'Tasks and CPD', route: '/projects/21/dashboard'},
    {
      key: 'ppi',
      label: 'Peer Progress Indicator',
      route: '/projects/21/dashboard/DUE7?walkthrough=ppi',
    },
    {key: 'notifications', label: 'Notifications', route: '/notifications'},
  ],
};

describe('DemoControlsComponent', () => {
  let fixture: ComponentFixture<DemoControlsComponent>;
  let demoMode: {available: boolean; enabled: boolean; setEnabled: ReturnType<typeof vi.fn>};
  let meetingLinks: {
    links: {helpHub: string; extraHelpHub: string};
    save: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    demoMode = {available: true, enabled: false, setEnabled: vi.fn()};
    meetingLinks = {links: {helpHub: '', extraHelpHub: ''}, save: vi.fn(), clear: vi.fn()};
    await TestBed.configureTestingModule({
      imports: [DemoToolsModule, NoopAnimationsModule],
      providers: [
        {provide: DemoModeStore, useValue: demoMode},
        {provide: DemoMeetingLinksStore, useValue: meetingLinks},
        {provide: DemoScenarioRegistryService, useValue: {scenario$: of(scenario), scenario}},
        {
          provide: PeerProgressDisplayPreferenceService,
          useValue: {enabled: false, setEnabled: (enabled: boolean) => enabled},
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DemoControlsComponent);
    fixture.detectChanges();
  });

  it('explains isolation and renders exact registry hooks', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Synthetic records in an isolated local runtime');
    expect(text).toContain('returns every normal API response unchanged');
    expect(text).toContain('10 tasks in');
    expect(text).toContain('DEMO10001');
    expect(text).toContain('60%');
    expect(text).toContain('10%');
    expect(text).toContain('Unavailable — insufficient cohort');
    expect(text).toContain('7 varied notification events');
    expect(text).toContain('Team Indigo (3/4)');
    expect(fixture.nativeElement.querySelector('[data-status="not_started"]')).toBeTruthy();
  });

  it('keeps the named demo section inside the app-owned main landmark', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('main, [role="main"]')).toBeNull();
    const section = element.querySelector('section.demo-controls');
    expect(section.getAttribute('aria-labelledby')).toBe('demo-controls-title');
    expect(section.querySelector('#demo-controls-title').textContent.trim()).toBe(
      'Demo walkthrough',
    );
  });

  it('toggles presentation without reloading or mutating entity caches', () => {
    fixture.componentInstance.setDemoMode({checked: true} as MatSlideToggleChange);
    expect(demoMode.setEnabled).toHaveBeenCalledWith(true);
  });

  it('retains the Unit Hub host controls and visual-only push preview', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Unit Hub: announcements, HelpHubs and classes');
    expect(text).toContain('Use your own HelpHub links');
    expect(text).toContain('Preview only');
    expect(text).toContain('Feedback is ready');
    expect(fixture.nativeElement.querySelector('a[href="/unit-hub"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/edit_profile"]')).toBeTruthy();
  });

  it('provides stable walkthrough link selectors', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="demo-link-tasks"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="demo-link-ppi"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="demo-link-notifications"]'),
    ).toBeTruthy();
  });

  it('links to the Unit Hub walkthrough and offers the Teams meeting draft', () => {
    const host: HTMLElement = fixture.nativeElement;
    const section = host.querySelector('[aria-labelledby="hub-demo-title"]');
    expect(section?.textContent).toContain('Unit Hub: announcements, HelpHubs and classes');
    expect(section?.querySelector('a[href="/unit-hub"]')?.textContent).toContain('Open Unit Hub');
    expect(section?.querySelector('f-teams-meeting-composer')).toBeTruthy();
  });

  it('saves hosted meeting links for this tab and reports a rejected link', () => {
    const component = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;
    const link = 'https://teams.microsoft.com/meet/123456789';
    component.meetingLinksForm.setValue({helpHub: link, extraHelpHub: ''});

    host.querySelector<HTMLButtonElement>('.hub-meeting-links button[type="submit"]').click();
    fixture.detectChanges();

    expect(meetingLinks.save).toHaveBeenCalledWith({helpHub: link, extraHelpHub: ''});
    expect(host.querySelector('.hub-meeting-links [role="status"]')?.textContent).toContain(
      'Saved for this browser tab',
    );

    meetingLinks.save.mockImplementation(() => {
      throw new Error('Use a Teams joining link.');
    });
    component.saveMeetingLinks();
    fixture.detectChanges();
    expect(host.querySelector('.hub-meeting-links [role="alert"]')?.textContent).toContain(
      'Use a Teams joining link.',
    );

    component.clearMeetingLinks();
    expect(meetingLinks.clear).toHaveBeenCalled();
    expect(component.meetingLinksForm.getRawValue()).toEqual({helpHub: '', extraHelpHub: ''});
  });

  it('includes the Batch 10 peer progress preview without duplicating the scenario registry', () => {
    expect(fixture.nativeElement.querySelector('f-ppi-preview')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ppi-preview-full"]')).toBeTruthy();
  });
});
