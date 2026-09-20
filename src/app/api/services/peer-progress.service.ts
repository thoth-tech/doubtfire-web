import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {
  DEMO_PEER_MEDIAN_STATE,
  DEMO_WEEKLY_REMAINING,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
import {PeerMedianPoint, PeerProgressResponse} from '../models/peer-progress';
import {Project} from '../models/project';
import {MappingFunctions} from './mapping-fn';

@Injectable({
  providedIn: 'root',
})
export class PeerProgressService {
  /**
   * Temporary proof-of-concept state.
   *
   * The future authorised backend must decide whether the result is ready,
   * suppressed, unavailable or disabled. It must not send the raw cohort size
   * to the browser.
   */
  public getCohortMedian(
    project: Project,
    targetGrade: number = project.targetGrade,
  ): Observable<PeerProgressResponse> {
    const state = DEMO_PEER_MEDIAN_STATE;

    return of({
      project_id: project.id,
      target_grade: targetGrade,
      state,
      median_burndown: state === 'ready' ? this.sampleProfile(project, DEMO_WEEKLY_REMAINING) : [],
    });
  }

  private sampleProfile(project: Project, profile: readonly number[]): PeerMedianPoint[] {
    const asOf = Date.now();
    const weeks = MappingFunctions.step(
      project.unit.startDate.getTime(),
      project.unit.endDate.getTime(),
      MappingFunctions.weeksMs(1),
    );

    // Map against the whole unit before removing future points. Mapping only
    // the elapsed weeks would incorrectly stretch the sample to 100% complete
    // at today's date and make the demo look like the cohort has finished every
    // task.
    return weeks
      .map((time, week) => ({
        date: new Date(time).toISOString(),
        remaining:
          profile[Math.round((week / Math.max(weeks.length - 1, 1)) * (profile.length - 1))],
      }))
      .filter((point) => new Date(point.date).getTime() <= asOf);
  }
}
