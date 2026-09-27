import {Notification} from 'src/app/api/models/notification';

export interface NotificationPresentation {
  icon: string;
  label: string;
  tone: 'feedback' | 'task' | 'portfolio' | 'extension' | 'general' | 'unit-hub';
}

const EVENT_PRESENTATIONS: Readonly<Record<string, NotificationPresentation>> = {
  new_task_available: {icon: 'assignment_add', label: 'New task', tone: 'task'},
  task_due_soon: {icon: 'event', label: 'Due soon', tone: 'task'},
  task_due_date_changed: {icon: 'edit_calendar', label: 'Date changed', tone: 'task'},
  task_comment_created: {icon: 'chat_bubble', label: 'New feedback', tone: 'feedback'},
  discussion_request_created: {
    icon: 'record_voice_over',
    label: 'Discussion prompt',
    tone: 'feedback',
  },
  task_status_changed: {icon: 'published_with_changes', label: 'Status changed', tone: 'task'},
  task_submitted: {icon: 'upload_file', label: 'Task submitted', tone: 'task'},
  task_help_requested: {icon: 'help', label: 'Help requested', tone: 'task'},
  extension_assessed: {icon: 'more_time', label: 'Extension', tone: 'extension'},
  // Filed under task notifications so a tutor can switch it off, but still drawn as
  // an extension so it reads as one in the list.
  extension_requested: {icon: 'more_time', label: 'Extension request', tone: 'extension'},
  portfolio_received: {icon: 'collections_bookmark', label: 'Portfolio', tone: 'portfolio'},
  // Staff side of the same submission, told apart from the student's receipt.
  portfolio_submitted: {icon: 'inventory', label: 'Portfolio submitted', tone: 'portfolio'},
  group_membership_changed: {icon: 'groups', label: 'Group update', tone: 'general'},
  tutorial_changed: {icon: 'event_repeat', label: 'Tutorial update', tone: 'general'},
  // Unit Hub. A cancellation is a session change too, and says so in its message.
  unit_announcement_published: {icon: 'campaign', label: 'Announcement', tone: 'unit-hub'},
  unit_announcement_updated: {icon: 'edit_note', label: 'Announcement updated', tone: 'unit-hub'},
  unit_session_changed: {icon: 'event_note', label: 'Session update', tone: 'unit-hub'},
  unit_session_starting_soon: {icon: 'alarm', label: 'Starting soon', tone: 'unit-hub'},
};

const CATEGORY_PRESENTATIONS: Readonly<Record<string, NotificationPresentation>> = {
  feedback: {icon: 'chat_bubble', label: 'Feedback', tone: 'feedback'},
  task: {icon: 'assignment', label: 'Task', tone: 'task'},
  portfolio: {icon: 'collections_bookmark', label: 'Portfolio', tone: 'portfolio'},
  extension: {icon: 'more_time', label: 'Extension', tone: 'extension'},
  general: {icon: 'campaign', label: 'OnTrack update', tone: 'general'},
  unit_hub: {icon: 'hub', label: 'Unit Hub', tone: 'unit-hub'},
};

const UNKNOWN_PRESENTATION: NotificationPresentation = {
  icon: 'notifications',
  label: 'Notification',
  tone: 'general',
};

/**
 * Stable notification presentation keyed by the API event hook.
 *
 * Event names, rather than message parsing, let due dates, feedback, status
 * changes and portfolio activity remain visibly different while keeping the
 * message body privacy-safe. The category fallback keeps an older browser
 * useful when the API adds an event this build has not learned yet.
 */
export function presentationFor(notification: Notification): NotificationPresentation {
  return (
    EVENT_PRESENTATIONS[notification.event] ??
    CATEGORY_PRESENTATIONS[notification.notificationType] ??
    UNKNOWN_PRESENTATION
  );
}
