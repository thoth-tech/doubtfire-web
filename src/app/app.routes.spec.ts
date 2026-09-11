import {describe, expect, it} from 'vitest';
import {Route, UrlSegment, UrlSegmentGroup} from '@angular/router';
import {projectDashboardTaskMatcher} from './app.routes';

const match = (paths: string[]) => {
  const segments = paths.map((path) => new UrlSegment(path, {}));
  return {
    result: projectDashboardTaskMatcher(segments, {} as UrlSegmentGroup, {} as Route),
    segments,
  };
};

describe('project dashboard task route matcher', () => {
  it('uses one reusable route for task details and feedback destinations', () => {
    const taskRoute = match(['dashboard', '1.1P']);
    const feedbackRoute = match(['dashboard', '1.1P', 'feedback']);

    expect(taskRoute.result?.consumed).toEqual(taskRoute.segments);
    expect(taskRoute.result?.posParams?.['taskAbbreviation'].path).toBe('1.1P');
    expect(taskRoute.result?.posParams?.['mobilePane']).toBeUndefined();

    expect(feedbackRoute.result?.consumed).toEqual(feedbackRoute.segments);
    expect(feedbackRoute.result?.posParams?.['taskAbbreviation'].path).toBe('1.1P');
    expect(feedbackRoute.result?.posParams?.['mobilePane'].path).toBe('feedback');
  });

  it('does not consume the dashboard root or unrelated suffixes', () => {
    expect(match(['dashboard']).result).toBeNull();
    expect(match(['dashboard', '1.1P', 'details']).result).toBeNull();
    expect(match(['dashboard', '1.1P', 'feedback', 'extra']).result).toBeNull();
  });
});
