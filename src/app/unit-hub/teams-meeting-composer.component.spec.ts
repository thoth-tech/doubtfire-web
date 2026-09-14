import {describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {TeamsMeetingComposerComponent} from './teams-meeting-composer.component';
import {TeamsMeetingDraft} from './teams-meeting-draft';

const session = (): TeamsMeetingDraft => ({
  title: 'Computer Systems HelpHub',
  description: 'Bring your questions.',
  start_at: '2026-09-17T07:00:00Z',
  end_at: '2026-09-17T08:00:00Z',
  timezone: 'Australia/Melbourne',
  recurrence: 'none',
});

function open(draft: TeamsMeetingDraft | null = session()) {
  const fixture = TestBed.createComponent(TeamsMeetingComposerComponent);
  fixture.componentRef.setInput('draft', draft);
  fixture.componentRef.setInput('unitCode', 'SIT111');
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
  };
}

describe('Teams meeting composer', () => {
  it('does not submit an enclosing OnTrack form when Enter is pressed in attendees', () => {
    const {element} = open();
    const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
    element.querySelector('input').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders a labelled, explicit draft link without any meeting creation action', () => {
    const {element} = open();
    const link = element.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Open Teams draft');
    expect(link.origin).toBe('https://teams.microsoft.com');
    expect(link.pathname).toBe('/l/meeting/new');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(element.textContent).toContain('press Send in Teams');
    expect(element.textContent).toContain('copy the meeting’s join link back');
    expect(element.querySelector('input')?.closest('label')?.textContent).toContain('Attendees');
    expect(element.querySelector('textarea')?.closest('label')?.textContent).toContain(
      'Teams details',
    );
    expect(element.querySelector('form')).toBeNull();
  });

  it('shows an actionable reason when the parent form is incomplete', () => {
    const {fixture, element} = open(null);
    fixture.componentRef.setInput('unavailableReason', 'Choose a valid end time.');
    fixture.detectChanges();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(element.querySelector('button')?.type).toBe('button');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Choose a valid end time',
    );
  });

  it('uses locally edited details and attendees while leaving the parent draft untouched', () => {
    const draft = Object.freeze(session());
    const {fixture, component, element} = open(draft);
    component.content.setValue('Shorter invitation');
    component.attendees.setValue('tutor@example.edu');
    fixture.detectChanges();
    const url = new URL((element.querySelector('a') as HTMLAnchorElement).href);
    expect(url.searchParams.get('content')).toBe('Shorter invitation');
    expect(url.searchParams.get('attendees')).toBe('tutor@example.edu');
    expect(draft.description).toBe('Bring your questions.');
    expect(draft.title).toBe('Computer Systems HelpHub');
  });

  it('retains composer edits across equivalent snapshots and time adjustments', () => {
    const {fixture, component} = open();
    component.content.setValue('My draft details');
    component.attendees.setValue('tutor@example.edu');
    fixture.componentRef.setInput('draft', {...session()});
    fixture.detectChanges();
    expect(component.content.value).toBe('My draft details');
    fixture.componentRef.setInput('draft', {...session(), end_at: '2026-09-17T09:00:00Z'});
    fixture.detectChanges();
    expect(component.content.value).toBe('My draft details');
    expect(new URL(component.launch.url).searchParams.get('endTime')).toBe(
      '2026-09-17T09:00:00.000Z',
    );
  });

  it('clears attendee selection when the unit changes or the draft is removed', () => {
    const {fixture, component} = open();
    component.attendees.setValue('previous-unit@example.edu');
    fixture.componentRef.setInput('unitCode', 'SIT102');
    fixture.detectChanges();
    expect(component.attendees.value).toBe('');
    expect(component.content.value).toContain('SIT102');
    component.attendees.setValue('tutor@example.edu');
    fixture.componentRef.setInput('draft', null);
    fixture.detectChanges();
    expect(component.attendees.value).toBe('');
    expect(component.content.value).toBe('');
    expect(component.launch.url).toBeNull();
  });

  it('updates details from changed session content and never renders it as HTML', () => {
    const {fixture, component, element} = open();
    fixture.componentRef.setInput('draft', {
      ...session(),
      description: '<img src=x onerror=alert(1)>',
    });
    fixture.detectChanges();
    expect(component.content.value).toContain('<img');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('textarea')?.value).toContain('<img');
  });

  it('discloses repeating schedule and mobile fallback limitations', () => {
    const {element} = open({...session(), recurrence: 'weekly', recurrence_until: '2026-11-26'});
    expect(element.textContent).toContain('Set the weekly repeat schedule in Teams');
    expect(element.textContent).toContain('2026-11-26');
    expect(element.textContent).toContain('If the draft does not open on your phone');
    expect(
      new URL((element.querySelector('a') as HTMLAnchorElement).href).searchParams.has(
        'recurrence',
      ),
    ).toBe(false);
  });

  it('removes the actionable link for invalid attendees and oversized drafts, then recovers', () => {
    const {fixture, component, element} = open();
    component.attendees.setValue('not an email');
    fixture.detectChanges();
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).toContain('sign-in email addresses');
    component.attendees.setValue('');
    component.content.setValue('🙂'.repeat(1500));
    fixture.detectChanges();
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).toContain('Shorten the Teams details');
    component.content.setValue('Shortened safely');
    fixture.detectChanges();
    expect(element.querySelector('a')).not.toBeNull();
  });
});
