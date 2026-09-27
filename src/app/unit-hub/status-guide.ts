import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';

export interface StatusGuideRow {
  status: TaskStatusEnum;
  /** Matches the --ot-status-<key> token, so the pill takes the app's own colour. */
  tone: string;
  icon: string;
  label: string;
  reason: string;
  action: string;
}

export interface StatusGuideGroup {
  key: string;
  title: string;
  icon: string;
  rows: StatusGuideRow[];
}

/**
 * Grouped by where a task sits in its life, rather than by the order the API
 * happens to list them. A student reading this wants to find their own status,
 * and "mine is with my tutor" narrows fifteen rows down to seven.
 */
const GROUPS: {key: string; title: string; icon: string; statuses: TaskStatusEnum[]}[] = [
  {
    key: 'yours',
    title: 'While the task is yours',
    icon: 'edit',
    statuses: ['not_started', 'working_on_it', 'need_help'],
  },
  {
    key: 'tutor',
    title: 'Once your tutor has it',
    icon: 'rate_review',
    statuses: [
      'ready_for_feedback',
      'fix_and_resubmit',
      'redo',
      'attention_required',
      'discuss',
      'rediscuss',
      'demonstrate',
    ],
  },
  {
    key: 'settled',
    title: 'Signed off, or past the deadline',
    icon: 'flag',
    statuses: ['complete', 'assess_in_portfolio', 'feedback_exceeded', 'time_exceeded', 'fail'],
  },
];

/**
 * Reads the same labels, icons and help text the task pages use, so this page
 * cannot drift from what a status actually means elsewhere in the app.
 */
export function buildStatusGuide(): StatusGuideGroup[] {
  return GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    icon: group.icon,
    rows: group.statuses
      .map((status) => {
        const data = TaskStatus.statusData(status);
        if (!data?.help) {
          return null;
        }

        return {
          status,
          tone: TaskStatus.statusClass(status),
          icon: data.materialIcon ?? 'help',
          label: data.label ?? status,
          reason: data.help.reason,
          action: data.help.action,
        } satisfies StatusGuideRow;
      })
      .filter((row): row is StatusGuideRow => row !== null),
  })).filter((group) => group.rows.length > 0);
}
