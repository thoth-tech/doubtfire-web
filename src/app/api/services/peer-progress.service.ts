import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoScenarioRegistryService,
  DemoUnitHook,
} from 'src/app/demo/demo-scenario-registry.service';
import {PeerMedianPoint, PeerProgressResponse} from '../models/peer-progress';
import {Project} from '../models/project';
import {MappingFunctions} from './mapping-fn';

@Injectable({
  providedIn: 'root',
})
export class PeerProgressService {
  constructor(
    private readonly demoMode: DemoModeStore,
    private readonly demoRegistry: DemoScenarioRegistryService,
  ) {}

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
    const unit = this.demoUnitFor(project.id);
    if (!unit) {
      return of(this.response(project.id, targetGrade, 'disabled'));
    }

    if (unit.ppi.state !== 'available') {
      const state =
        unit.ppi.unavailable_reason === 'insufficient_cohort' ? 'suppressed' : 'unavailable';
      return of(this.response(project.id, targetGrade, state));
    }

    const submitted = unit.ppi.submitted_percentage;
    if (typeof submitted !== 'number' || submitted < 0 || submitted > 100) {
      return of(this.response(project.id, targetGrade, 'unavailable'));
    }

    const scenario = this.demoRegistry.scenario;
    const unitIndex = scenario?.units.findIndex((candidate) => candidate.key === unit.key) ?? 0;
    const comparisonOffset = unitIndex % 2 === 0 ? 0.08 : -0.08;
    const currentRemaining = Math.min(0.95, Math.max(0.05, 1 - submitted / 100 + comparisonOffset));

    return of({
      project_id: project.id,
      target_grade: targetGrade,
      state: 'ready',
      median_burndown: this.sampleProfile(project, currentRemaining),
    });
  }

  private response(
    projectId: number,
    targetGrade: number,
    state: PeerProgressResponse['state'],
  ): PeerProgressResponse {
    return {project_id: projectId, target_grade: targetGrade, state, median_burndown: []};
  }

  private demoUnitFor(projectId: number): DemoUnitHook | undefined {
    if (!this.demoMode.enabled) {
      return undefined;
    }

    return this.demoRegistry.scenario?.units.find((unit) => unit.project_id === projectId);
  }

  private sampleProfile(project: Project, currentRemaining: number): PeerMedianPoint[] {
    const asOf = Date.now();
    const weeks = MappingFunctions.step(
      project.unit.startDate.getTime(),
      project.unit.endDate.getTime(),
      MappingFunctions.weeksMs(1),
    );

    const elapsed = weeks.filter((time) => time <= asOf);
    const finalIndex = Math.max(elapsed.length - 1, 1);

    return elapsed.map((time, week) => ({
      date: new Date(time).toISOString(),
      remaining: Number((1 - (1 - currentRemaining) * (week / finalIndex)).toFixed(2)),
    }));
  }
}
