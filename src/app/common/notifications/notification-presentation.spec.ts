import {describe, expect, it} from 'vitest';
import {Notification} from 'src/app/api/models/notification';
import {presentationFor} from './notification-presentation';

function notification(event: string, notificationType = 'task'): Notification {
  return Object.assign(new Notification(), {event, notificationType});
}

describe('notification presentation', () => {
  it('distinguishes every deterministic demo event without reading message text', () => {
    expect(
      [
        'new_task_available',
        'task_due_soon',
        'task_due_date_changed',
        'task_comment_created',
        'task_status_changed',
        'extension_assessed',
        'portfolio_received',
      ].map((event) => presentationFor(notification(event)).label),
    ).toEqual([
      'New task',
      'Due soon',
      'Date changed',
      'New feedback',
      'Status changed',
      'Extension',
      'Portfolio',
    ]);
  });

  // Tutors are told when a student asks for help or for an extension. The request is
  // a task notification so it can be switched off, and still reads as an extension.
  it('names the tutor request events apart from the category they are filed under', () => {
    expect(presentationFor(notification('task_help_requested'))).toMatchObject({
      icon: 'help',
      label: 'Help requested',
      tone: 'task',
    });
    expect(presentationFor(notification('extension_requested', 'task'))).toMatchObject({
      icon: 'more_time',
      label: 'Extension request',
      tone: 'extension',
    });
  });

  it('draws the staff portfolio notification apart from the student receipt', () => {
    expect(presentationFor(notification('portfolio_submitted', 'portfolio'))).toMatchObject({
      icon: 'inventory',
      label: 'Portfolio submitted',
      tone: 'portfolio',
    });
  });

  it('draws Unit Hub announcements and sessions in their own tone', () => {
    expect(
      [
        'unit_announcement_published',
        'unit_announcement_updated',
        'unit_session_changed',
        'unit_session_starting_soon',
      ].map((event) => presentationFor(notification(event, 'unit_hub'))),
    ).toEqual([
      {icon: 'campaign', label: 'Announcement', tone: 'unit-hub'},
      {icon: 'edit_note', label: 'Announcement updated', tone: 'unit-hub'},
      {icon: 'event_note', label: 'Session update', tone: 'unit-hub'},
      {icon: 'alarm', label: 'Starting soon', tone: 'unit-hub'},
    ]);
    expect(presentationFor(notification('unit_hub_future_event', 'unit_hub'))).toEqual({
      icon: 'hub',
      label: 'Unit Hub',
      tone: 'unit-hub',
    });
  });

  it('uses a category fallback for a new event and a generic fallback for a new category', () => {
    expect(presentationFor(notification('future_feedback_event', 'feedback'))).toMatchObject({
      icon: 'chat_bubble',
      label: 'Feedback',
      tone: 'feedback',
    });
    expect(presentationFor(notification('future_event', 'future_category'))).toMatchObject({
      icon: 'notifications',
      label: 'Notification',
      tone: 'general',
    });
  });
});
