/** Copy: github-guide/onboarding-tutorial-step-copy.md (DOC-11). */
export const ONBOARDING_VERSION = 1;
export type OnboardingStepId = 'unit' | 'tasks' | 'target-grade' | 'calendar';
export interface OnboardingStep {
  id: OnboardingStepId;
  version: number;
  route: 'current' | 'project-dashboard';
  target: string;
  title: string;
  body: string;
  action: string;
  fallback: string;
}
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'unit',
    version: ONBOARDING_VERSION,
    route: 'current',
    target: 'unit-selector',
    title: 'Choose Your Unit',
    body: 'Use the unit selector to open the unit you want to work on.',
    action: 'Find unit selector',
    fallback:
      'Use Select Unit in the toolbar. If no units appear, check your enrolment with your teaching team. You can continue without a unit.',
  },
  {
    id: 'tasks',
    version: ONBOARDING_VERSION,
    route: 'project-dashboard',
    target: 'task-dashboard',
    title: 'Find Your Tasks',
    body: 'This dashboard shows the tasks for your selected unit and the progress you have made.',
    action: 'Find task dashboard',
    fallback:
      'Choose a unit, then open Dashboard from its navigation menu to find tasks and their statuses. You can continue without opening a project.',
  },
  {
    id: 'target-grade',
    version: ONBOARDING_VERSION,
    route: 'project-dashboard',
    target: 'target-grade',
    title: 'Check Your Target Grade',
    body: 'Your target grade shows the result you are working towards, and you can change it here if needed.',
    action: 'Find target grade',
    fallback:
      'Open your unit dashboard and find Select Target Grade. If this control is unavailable, continue the tutorial; no grade will be changed.',
  },
  {
    id: 'calendar',
    version: ONBOARDING_VERSION,
    route: 'current',
    target: 'calendar',
    title: 'Use the Calendar',
    body: 'Open the calendar options to download or subscribe to important unit dates.',
    action: 'Find Calendar',
    fallback:
      'Open the account menu and choose Calendar. You can continue if Calendar is unavailable. This tutorial never creates a subscription.',
  },
];
