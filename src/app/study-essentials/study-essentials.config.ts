import {InjectionToken} from '@angular/core';

export type StudyEssentialsProfile = 'deakin' | '';

/**
 * Shared deployment choice for development, production and the demo.
 * This fork serves Deakin. Operators at another institution should set this
 * to '' before building to hide these links, or add their own reviewed profile.
 * Never infer institution membership from an email, product name or unit code.
 */
export const studyEssentialsProfile: StudyEssentialsProfile = 'deakin';

export const STUDY_ESSENTIALS_PROFILE: InjectionToken<StudyEssentialsProfile> = new InjectionToken(
  'Study essentials profile',
  {providedIn: 'root', factory: () => studyEssentialsProfile},
);

export interface StudyEssential {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly icon: string;
}

// Public, non-session entry points verified against Deakin's official pages
// on 14 September 2026. Course sites and meeting links belong to their units.
const deakinEssentials: readonly StudyEssential[] = [
  {
    title: 'DeakinSync',
    description: 'Your unit sites and university services.',
    url: 'https://sync.deakin.edu.au/',
    icon: 'dashboard',
  },
  {
    title: 'CloudDeakin',
    description: 'Learning materials and assessments.',
    url: 'https://d2l.deakin.edu.au/',
    icon: 'school',
  },
  {
    title: 'StudentConnect',
    description: 'Enrolment, fees and results.',
    url: 'https://studentconnect.deakin.edu.au/connect/webconnect',
    icon: 'account_circle',
  },
  {
    title: 'STAR timetable',
    description: 'Your timetable and calendar guidance.',
    // The direct STAR application alternates between odd/even year addresses.
    // Deakin maintains the current entry point on this stable public page.
    url: 'https://www.deakin.edu.au/students/study-support/study-timetables',
    icon: 'calendar_month',
  },
  {
    title: 'Deakin Library',
    description: 'Books, articles and unit readings.',
    url: 'https://www.deakin.edu.au/library',
    icon: 'local_library',
  },
  {
    title: 'Student Central',
    description: 'Course advice and student enquiries.',
    url: 'https://www.deakin.edu.au/students/help/student-central',
    icon: 'support_agent',
  },
];

export function studyEssentialsFor(profile: StudyEssentialsProfile): readonly StudyEssential[] {
  return profile === 'deakin' ? deakinEssentials : [];
}
