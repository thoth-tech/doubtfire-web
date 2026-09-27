import {TaskDefinition} from 'src/app/api/models/task-definition';

/**
 * The fields a convenor changes in the task editor and then saves with Save task.
 * Files, prerequisites, discussion prompts and Overseer steps save the moment they
 * change, so they are left out: discarding an edit must not undo an upload.
 */
export const EDITABLE_TASK_DEFINITION_FIELDS = [
  'abbreviation',
  'name',
  'description',
  'weighting',
  'targetGrade',
  'startDate',
  'targetDate',
  'dueDate',
  'gradeDueDates',
  'tutorialStream',
  'groupSet',
  'lockAssessmentsToTutorialStream',
  'uploadRequirements',
  'similarityLanguage',
  'plagiarismWarnPct',
  'useResourcesForJplagBaseCode',
  'restrictStatusUpdates',
  'assessInPortfolioOnly',
  'requiresDiscussion',
  'isGraded',
  'maxQualityPts',
  'scormEnabled',
  'scormAllowReview',
  'scormBypassTest',
  'scormTimeDelayEnabled',
  'scormAttemptLimit',
  'overseerImageId',
  'assessmentEnabled',
] as const satisfies readonly (keyof TaskDefinition)[];

type EditableField = (typeof EDITABLE_TASK_DEFINITION_FIELDS)[number];

export type TaskDefinitionSnapshot = Partial<Pick<TaskDefinition, EditableField>>;

// Dates and the plain objects in the upload requirement and grade date lists are
// copied, because the editor changes them in place. Linked records such as the
// tutorial stream and the group set are kept as the same object, which is what the
// selects compare against.
function copyValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => copyValue(item)) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copyValue(item)]),
    ) as T;
  }
  return value;
}

export function snapshotTaskDefinition(taskDefinition: TaskDefinition): TaskDefinitionSnapshot {
  const snapshot: TaskDefinitionSnapshot = {};
  for (const field of EDITABLE_TASK_DEFINITION_FIELDS) {
    (snapshot as Record<string, unknown>)[field] = copyValue(taskDefinition[field]);
  }
  return snapshot;
}

export function restoreTaskDefinition(
  taskDefinition: TaskDefinition,
  snapshot: TaskDefinitionSnapshot,
): void {
  for (const field of EDITABLE_TASK_DEFINITION_FIELDS) {
    if (field in snapshot) {
      (taskDefinition as unknown as Record<string, unknown>)[field] = copyValue(snapshot[field]);
    }
  }
}

// The saved values of each task, kept outside the Tasks tab so they outlive it.
// The tab is built again each time it opens, and a copy taken then would hold
// any edits left unsaved on the last visit, so Discard would keep them.
const savedCopies: WeakMap<TaskDefinition, TaskDefinitionSnapshot> = new WeakMap();

/** Record the task's current values as the ones Discard goes back to. */
export function rememberSavedTaskDefinition(taskDefinition: TaskDefinition): void {
  savedCopies.set(taskDefinition, snapshotTaskDefinition(taskDefinition));
}

export function savedTaskDefinitionCopy(
  taskDefinition: TaskDefinition,
): TaskDefinitionSnapshot | undefined {
  return savedCopies.get(taskDefinition);
}
