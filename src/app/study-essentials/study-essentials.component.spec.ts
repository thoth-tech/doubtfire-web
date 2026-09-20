import {beforeEach, describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {StudyEssentialsComponent} from './study-essentials.component';
import {STUDY_ESSENTIALS_PROFILE, studyEssentialsFor} from './study-essentials.config';

describe('Study essentials', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [StudyEssentialsComponent]});
  });

  it('shows the six public Deakin services from the shared configured profile', () => {
    const fixture = TestBed.createComponent(StudyEssentialsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const titles = Array.from(element.querySelectorAll('a strong')).map((node) => node.textContent);
    expect(titles).toEqual([
      'DeakinSync',
      'CloudDeakin',
      'StudentConnect',
      'STAR timetable',
      'Deakin Library',
      'Student Central',
    ]);
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Study essentials');
  });

  it('renders safe external links with no opener or referrer access', () => {
    const fixture = TestBed.createComponent(StudyEssentialsComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    expect(links).toHaveLength(6);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(link.textContent).toContain('Opens in a new tab');
    }
  });

  it('uses only public Deakin entry points without course, account or meeting identifiers', () => {
    for (const link of studyEssentialsFor('deakin')) {
      const url = new URL(link.url);
      expect(url.protocol).toBe('https:');
      expect(url.hostname.endsWith('.deakin.edu.au')).toBe(true);
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(url.port).toBe('');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
      expect(url.pathname).not.toMatch(/\d|meeting|\/d2l\/home\//i);
    }
    const timetable = studyEssentialsFor('deakin').find((link) => link.title === 'STAR timetable');
    expect(timetable.url).toBe('https://www.deakin.edu.au/students/study-support/study-timetables');
  });

  it('renders no Deakin links or panel when the institution profile is disabled', () => {
    TestBed.overrideProvider(STUDY_ESSENTIALS_PROFILE, {useValue: ''});
    const fixture = TestBed.createComponent(StudyEssentialsComponent);
    fixture.detectChanges();
    expect(studyEssentialsFor('')).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });
});
