import {Injectable} from '@angular/core';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';

/** Last status the student saw for each task, keyed by task definition id. */
export type SeenStatusMap = Record<string, TaskStatusEnum>;

export interface TaskStatusSnapshot {
  taskDefinitionId: number;
  status: TaskStatusEnum;
}

export interface TaskStatusChanges {
  /** Nothing stored yet. Callers record silently and celebrate nothing. */
  firstVisit: boolean;
  completed: number[];
  readyToDiscuss: number[];
  needsChanges: number[];
  previous: SeenStatusMap;
}

const DISCUSS_STATUSES: TaskStatusEnum[] = ['discuss', 'demonstrate'];
const NEEDS_CHANGES_STATUSES: TaskStatusEnum[] = ['fix_and_resubmit', 'redo'];

/**
 * Remembers, per user and project, the task statuses a student last saw on their
 * dashboard. Storage can be missing, full or blocked (private windows, embedded
 * previews), so every access is guarded and a failure reads as a first visit.
 */
@Injectable({
  providedIn: 'root',
})
export class TaskStatusSeenService {
  public storageKey(userId: number, projectId: number): string {
    return `ontrack.taskStatusSeen.${userId}.${projectId}`;
  }

  public read(userId: number, projectId: number): SeenStatusMap | null {
    if (!this.validIds(userId, projectId)) {
      return null;
    }

    try {
      const raw = globalThis.localStorage.getItem(this.storageKey(userId, projectId));
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      const seen: SeenStatusMap = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([id, status]) => {
        if (TaskStatus.isStatus(status)) {
          seen[id] = status;
        }
      });
      return seen;
    } catch {
      return null;
    }
  }

  public record(userId: number, projectId: number, snapshots: TaskStatusSnapshot[]): boolean {
    if (!this.validIds(userId, projectId)) {
      return false;
    }

    const seen: SeenStatusMap = {};
    snapshots.forEach((snapshot) => {
      seen[String(snapshot.taskDefinitionId)] = snapshot.status;
    });

    try {
      globalThis.localStorage.setItem(this.storageKey(userId, projectId), JSON.stringify(seen));
      return true;
    } catch {
      return false;
    }
  }

  /** Compares the current statuses with the stored ones. Does not write. */
  public detectChanges(
    userId: number,
    projectId: number,
    snapshots: TaskStatusSnapshot[],
  ): TaskStatusChanges {
    const previous = this.read(userId, projectId);
    const changes: TaskStatusChanges = {
      firstVisit: previous === null,
      completed: [],
      readyToDiscuss: [],
      needsChanges: [],
      previous: previous ?? {},
    };

    if (previous === null) {
      return changes;
    }

    snapshots.forEach(({taskDefinitionId, status}) => {
      const before = previous[String(taskDefinitionId)];
      if (before === status) {
        return;
      }

      if (status === 'complete') {
        changes.completed.push(taskDefinitionId);
      } else if (DISCUSS_STATUSES.includes(status) && !DISCUSS_STATUSES.includes(before)) {
        changes.readyToDiscuss.push(taskDefinitionId);
      } else if (
        NEEDS_CHANGES_STATUSES.includes(status) &&
        !NEEDS_CHANGES_STATUSES.includes(before)
      ) {
        changes.needsChanges.push(taskDefinitionId);
      }
    });

    return changes;
  }

  private validIds(userId: number, projectId: number): boolean {
    return Number.isFinite(userId) && userId > 0 && Number.isFinite(projectId) && projectId > 0;
  }
}
