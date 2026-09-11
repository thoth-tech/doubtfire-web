import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map, of} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoPeerProgressState,
  createDemoUnitSummary,
  createMaskedPeerProgressIndicator,
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
  ) {}

  getIndicator(projectId: number, taskDefinitionId: number): Observable<PeerProgressIndicator> {
    if (this.demoMode.shouldMaskApiData) {
      return of(createMaskedPeerProgressIndicator(taskDefinitionId));
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
}
