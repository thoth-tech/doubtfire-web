import {describe, expect, it, vi} from 'vitest';
import {BehaviorSubject, of} from 'rxjs';
import {HomeComponent} from './home.component';

// The home template goes through the migration shim, so these tests drive the
// component class directly rather than rendering it.
function homeFor(projects: unknown[], unitRoles: unknown[]) {
  const loading: BehaviorSubject<boolean> = new BehaviorSubject(true);
  const globalState = {
    showHeader: vi.fn(),
    setView: vi.fn(),
    unitRolesSubject: of(unitRoles),
    projectsSubject: of(projects),
    onLoad: (run: () => void) => {
      loading.subscribe((isLoading) => {
        if (!isLoading) {
          run();
        }
      });
    },
  };
  const component = new HomeComponent(
    {ExternalName: {value: 'OnTrack'}} as never,
    globalState as never,
    {currentUser: {role: 'Student', preferredName: 'Sam'}} as never,
    {showDate: vi.fn()} as never,
    {navigateByUrl: vi.fn()} as never,
  );
  component.ngOnInit();
  return {component, loading};
}

describe('HomeComponent not enrolled message', () => {
  it('stays hidden while units and projects are still loading', () => {
    const {component} = homeFor([], []);

    expect(component.notEnrolled).toBe(false);
  });

  it('shows once loading finishes with no projects and no unit roles', () => {
    const {component, loading} = homeFor([], []);

    loading.next(false);

    expect(component.notEnrolled).toBe(true);
  });

  it('stays hidden for a student with a project', () => {
    const {component, loading} = homeFor([{unit: {myRole: 'Student'}}], []);

    loading.next(false);

    expect(component.notEnrolled).toBe(false);
  });

  it('stays hidden for staff with a unit role', () => {
    const {component, loading} = homeFor([], [{id: 1}]);

    loading.next(false);

    expect(component.notEnrolled).toBe(false);
  });
});
