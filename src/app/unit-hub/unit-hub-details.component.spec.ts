import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {unitHubDemo} from './unit-hub-demo.fixtures';
import {UnitHubDetailsComponent, UnitHubDetailsData} from './unit-hub-details.component';

const session = () => unitHubDemo(new Date('2026-09-14T06:00:00Z')).sessions[0];

describe('Unit Hub full details', () => {
  let close: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    close = vi.fn();
  });

  async function render(data: Partial<UnitHubDetailsData>) {
    TestBed.configureTestingModule({
      imports: [UnitHubDetailsComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            unitCode: 'SIT111',
            unitName: 'Computer Systems',
            demo: false,
            canManage: false,
            ...data,
          },
        },
        {provide: MatDialogRef, useValue: {close}},
      ],
    });
    const fixture = TestBed.createComponent(UnitHubDetailsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows full dates, zone, recurrence, source and content without injecting HTML', async () => {
    const row = {
      ...session(),
      recurrence: 'weekly' as const,
      recurrence_until: '2026-10-14',
      description: 'First line\n<script>alert(1)</script>\nLast line',
      source_url: 'https://teams.microsoft.com/l/message/example',
    };
    const {element} = await render({session: row});
    const text = element.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('First line <script>alert(1)</script> Last line');
    expect(element.querySelector('script')).toBeNull();
    expect(element.querySelector(`time[datetime="${row.start_at}"]`)).not.toBeNull();
    expect(element.querySelector(`time[datetime="${row.end_at}"]`)).not.toBeNull();
    expect(text).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(text).toContain('Part of a weekly series');
    expect(
      element
        .querySelector('a[href="https://teams.microsoft.com/l/message/example"]')
        ?.getAttribute('rel'),
    ).toBe('noopener noreferrer');
  });

  it('suppresses unsafe links even when supplied to the dialog directly', async () => {
    const {element} = await render({
      session: {...session(), source_url: 'javascript:alert(1)'},
      joinUrl: 'https://user:password@example.test/meet',
      googleCalendarUrl: 'data:text/html,test',
    });
    expect(element.querySelector('a')).toBeNull();
  });

  it('stops download and calendar callbacks after selected data is cleared', async () => {
    const download = vi.fn();
    const calendarSettings = vi.fn();
    const {component, fixture, element} = await render({
      session: session(),
      download,
      calendarSettings,
    });
    component.clear();
    fixture.detectChanges();
    component.download();
    component.calendarSettings();
    expect(download).not.toHaveBeenCalled();
    expect(calendarSettings).not.toHaveBeenCalled();
    expect(element.textContent.trim()).toBe('');
  });

  it('blocks cancelled downloads and demo subscriptions at method level', async () => {
    const download = vi.fn();
    const calendarSettings = vi.fn();
    const {component, element} = await render({
      session: {...session(), cancelled: true},
      demo: true,
      canManage: true,
      download,
      calendarSettings,
    });
    component.download();
    component.calendarSettings();
    expect(download).not.toHaveBeenCalled();
    expect(calendarSettings).not.toHaveBeenCalled();
    expect(element.querySelector('f-teams-meeting-composer')).toBeNull();
    expect(element.querySelector('a[href^="https://calendar.google.com"]')).toBeNull();
  });

  it('uses the explicit copy action and calendar settings only after clicks', async () => {
    const download = vi.fn();
    const calendarSettings = vi.fn();
    const {component, element} = await render({session: session(), download, calendarSettings});
    expect(download).not.toHaveBeenCalled();
    expect(calendarSettings).not.toHaveBeenCalled();
    const button = Array.from(element.querySelectorAll('button')).find((item) =>
      item.textContent.includes('Download .ics'),
    );
    button.click();
    expect(download).toHaveBeenCalledOnce();
    component.calendarSettings();
    expect(calendarSettings).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
