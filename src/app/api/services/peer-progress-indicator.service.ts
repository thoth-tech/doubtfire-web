import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map, of} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoPpiHook,
  DemoScenarioRegistryService,
  DemoUnitHook,
} from 'src/app/demo/demo-scenario-registry.service';
import {
  DemoPeerProgressState,
  createDemoUnitSummary,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
import {
  PeerProgressDistributionUnavailableReason,
  PeerProgressIndicator,
  PeerProgressUnavailableReason,
} from '../models/peer-progress-indicator';
import {PeerProgressUnitSummary} from '../models/peer-progress-unit-summary';
import {TaskStatus, TaskStatusEnum} from '../models/task-status';

interface PeerProgressStatusDistributionResponse {
  status: string;
  percentage: number;
}

interface PeerProgressIndicatorResponse {
  task_definition_id: number;
  unit_id: number;
  target_grade: number | null;
  submitted_percentage: number | null;
  completed_percentage?: number | null;
  distribution_available?: boolean;
  status_distribution?: PeerProgressStatusDistributionResponse[] | null;
  is_user_enabled?: boolean;
  unavailable_reason?: string | null;
  distribution_unavailable_reason?: string | null;
  is_suppressed: boolean;
  is_stale: boolean;
  is_feature_enabled: boolean;
  last_updated_at: string | null;
  unavailable_message: string;
}

@Injectable({
  providedIn: 'root',
})
export class PeerProgressIndicatorService {
  private readonly knownStatuses: Set<TaskStatusEnum> = new Set(TaskStatus.STATUS_KEYS);
  private readonly unavailableReasons: Set<PeerProgressUnavailableReason> = new Set([
    'user_disabled',
    'feature_disabled',
    'target_grade_unavailable',
    'snapshot_unavailable',
    'insufficient_cohort',
    'aggregation_incomplete',
    'stale',
  ]);
  private readonly distributionUnavailableReasons: Set<PeerProgressDistributionUnavailableReason> =
    new Set(['detailed_data_unavailable', 'privacy_protection', ...this.unavailableReasons]);

  constructor(
    private httpClient: HttpClient,
    private demoMode: DemoModeStore,
    private demoRegistry: DemoScenarioRegistryService,
  ) {}

  getIndicator(projectId: number, taskDefinitionId: number): Observable<PeerProgressIndicator> {
    const demoUnit = this.findDemoUnit(projectId, taskDefinitionId);
    if (demoUnit) {
      return of(this.mapDemoIndicator(demoUnit));
    }

    const url = `${API_URL}/projects/${projectId}/task_def_id/${taskDefinitionId}/peer_progress`;

    return this.httpClient.get<PeerProgressIndicatorResponse>(url).pipe(
      map((response) => {
        const isUserEnabled = response.is_user_enabled !== false;
        const mayExposeCompact =
          isUserEnabled &&
          response.is_feature_enabled &&
          !response.is_suppressed &&
          !response.is_stale;
        const mayExposeDistribution = mayExposeCompact && response.distribution_available === true;
        const statusDistribution = mayExposeDistribution
          ? this.mapStatusDistribution(response.status_distribution)
          : null;
        const distributionAvailable = statusDistribution !== null;

        return {
          taskDefinitionId: response.task_definition_id,
          unitId: response.unit_id,
          targetGrade: response.target_grade,
          submittedPercentage: mayExposeCompact
            ? this.mapCompactPercentage(response.submitted_percentage)
            : null,
          completedPercentage: mayExposeCompact
            ? this.mapCompactPercentage(response.completed_percentage)
            : null,
          distributionAvailable,
          statusDistribution: statusDistribution ?? [],
          isUserEnabled,
          isSuppressed: response.is_suppressed,
          isStale: response.is_stale,
          isFeatureEnabled: response.is_feature_enabled,
          lastUpdatedAt: response.last_updated_at,
          unavailableMessage: response.unavailable_message,
          unavailableReason: this.mapUnavailableReason(response.unavailable_reason),
          distributionUnavailableReason: this.mapDistributionUnavailableReason(
            response.distribution_unavailable_reason,
          ),
        };
      }),
    );
  }

  private mapUnavailableReason(
    reason: string | null | undefined,
  ): PeerProgressUnavailableReason | null {
    return this.unavailableReasons.has(reason as PeerProgressUnavailableReason)
      ? (reason as PeerProgressUnavailableReason)
      : null;
  }

  private mapDistributionUnavailableReason(
    reason: string | null | undefined,
  ): PeerProgressDistributionUnavailableReason | null {
    return this.distributionUnavailableReasons.has(
      reason as PeerProgressDistributionUnavailableReason,
    )
      ? (reason as PeerProgressDistributionUnavailableReason)
      : null;
  }

  private mapStatusDistribution(
    distribution: PeerProgressStatusDistributionResponse[] | null | undefined,
  ): PeerProgressIndicator['statusDistribution'] | null {
    if (!Array.isArray(distribution) || distribution.length !== this.knownStatuses.size) {
      return null;
    }

    const seen: Set<TaskStatusEnum> = new Set();
    const result: PeerProgressIndicator['statusDistribution'] = [];

    for (const entry of distribution) {
      const status = entry?.status as TaskStatusEnum;
      const percentage = entry?.percentage;

      if (
        !this.knownStatuses.has(status) ||
        seen.has(status) ||
        typeof percentage !== 'number' ||
        !Number.isFinite(percentage) ||
        percentage < 0 ||
        percentage > 100 ||
        percentage % 10 !== 0
      ) {
        return null;
      }

      seen.add(status);
      result.push({status, percentage});
    }

    return seen.size === this.knownStatuses.size ? result : null;
  }

  private mapCompactPercentage(value: unknown): number | null {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100 &&
      value % 10 === 0
      ? value
      : null;
  }

  /**
   * Builds a privacy-safe unit-summary fixture for PPI-F02 tests and demos.
   *
   * This is mock-only. It must not be treated as the live PPI-F01 production
   * adapter, and the caller-supplied target grade must never become the design
   * of a future live endpoint.
   */
  getDemoUnitSummary(
    unitId: number,
    targetGrade: number,
    studentPercentage: number | null,
    state: DemoPeerProgressState,
  ): Observable<PeerProgressUnitSummary> {
    return of(createDemoUnitSummary(unitId, targetGrade, studentPercentage, state));
  }

  /**
   * Maps the guarded Batch 09 contract into the existing privacy-safe summary.
   * Dynamic demo IDs stay in the registry and never enter normal entity caches.
   */
  getScenarioUnitSummary(
    projectId: number,
    unitId: number,
    targetGrade: number,
    studentPercentage: number | null,
  ): Observable<PeerProgressUnitSummary> {
    const unit = this.findDemoUnit(projectId);

    if (!unit || unit.unit_id !== unitId) {
      return of(createDemoUnitSummary(unitId, targetGrade, studentPercentage, 'unavailable'));
    }

    if (unit.ppi.state !== 'available') {
      return of(createDemoUnitSummary(unitId, targetGrade, studentPercentage, 'suppressed'));
    }

    const submittedPercentage = this.mapCompactPercentage(unit.ppi.submitted_percentage);
    if (submittedPercentage === null) {
      return of(createDemoUnitSummary(unitId, targetGrade, studentPercentage, 'unavailable'));
    }

    return of({
      ...createDemoUnitSummary(unitId, targetGrade, studentPercentage, 'normal'),
      submittedPercentage,
      cohortLabel: `Anonymous cohort — ${unit.ppi.task_abbreviation} submitted`,
      lastUpdatedAt: this.demoRegistry.scenario?.generated_at ?? null,
    });
  }

  private findDemoUnit(projectId: number, taskDefinitionId?: number): DemoUnitHook | undefined {
    if (!this.demoMode.enabled) {
      return undefined;
    }

    return this.demoRegistry.scenario?.units.find(
      (unit) =>
        unit.project_id === projectId &&
        (taskDefinitionId === undefined || unit.ppi.task_definition_id === taskDefinitionId),
    );
  }

  private mapDemoIndicator(unit: DemoUnitHook): PeerProgressIndicator {
    const hook: DemoPpiHook = unit.ppi;
    const timestamp = this.demoRegistry.scenario?.generated_at ?? null;

    if (hook.state !== 'available') {
      return {
        taskDefinitionId: hook.task_definition_id,
        unitId: unit.unit_id,
        targetGrade: null,
        submittedPercentage: null,
        completedPercentage: null,
        distributionAvailable: false,
        statusDistribution: [],
        isUserEnabled: true,
        isSuppressed: hook.unavailable_reason === 'insufficient_cohort',
        isStale: false,
        isFeatureEnabled: true,
        lastUpdatedAt: timestamp,
        unavailableMessage: 'Not enough students to show anonymous peer progress for this unit.',
        unavailableReason: 'insufficient_cohort',
        distributionUnavailableReason: 'insufficient_cohort',
      };
    }

    const submittedPercentage = this.mapCompactPercentage(hook.submitted_percentage);
    const completedPercentage = this.mapCompactPercentage(hook.completed_percentage);
    const statusDistribution = this.mapStatusDistribution(hook.status_distribution);
    const compactAvailable = submittedPercentage !== null || completedPercentage !== null;

    return {
      taskDefinitionId: hook.task_definition_id,
      unitId: unit.unit_id,
      targetGrade: null,
      submittedPercentage,
      completedPercentage,
      distributionAvailable: statusDistribution !== null,
      statusDistribution: statusDistribution ?? [],
      isUserEnabled: true,
      isSuppressed: false,
      isStale: false,
      isFeatureEnabled: true,
      lastUpdatedAt: timestamp,
      unavailableMessage: compactAvailable ? '' : 'Peer progress is unavailable for this unit.',
      unavailableReason: compactAvailable ? null : 'snapshot_unavailable',
      distributionUnavailableReason:
        statusDistribution === null ? 'detailed_data_unavailable' : null,
    };
  }
}
