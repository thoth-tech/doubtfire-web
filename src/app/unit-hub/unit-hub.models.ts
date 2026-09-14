export interface HubUnit {
  id: number;
  code: string;
  name: string;
  can_manage: boolean;
  teams_sync?: 'configured' | 'not_configured';
}

export interface UnitAnnouncement {
  source_provider?: 'manual' | 'microsoft_teams';
  managed_externally?: boolean;
  author_name?: string | null;
  id: number;
  unit_id: number;
  unit_code?: string;
  unit_name?: string;
  title: string;
  body: string;
  published_at: string | null;
  expires_at?: string | null;
  source_url?: string | null;
  pinned: boolean;
}

export type SessionKind = 'helphub' | 'lecture' | 'seminar' | 'workshop' | 'other';

export interface LearningSession {
  /** Browser-local demo fixture only; never persisted or returned by the API. */
  demo_hosted_join?: boolean;
  id: number;
  unit_id: number;
  unit_code?: string;
  unit_name?: string;
  title: string;
  description: string;
  kind: SessionKind;
  start_at: string;
  end_at: string;
  timezone: string;
  join_url?: string | null;
  location?: string | null;
  source_url?: string | null;
  published: boolean;
  cancelled: boolean;
  recurrence: 'none' | 'weekly';
  recurrence_until?: string | null;
  occurrence_id?: string;
  original_start_at?: string;
}

export interface UnitHubFeed {
  announcements_truncated?: boolean;
  window_start?: string;
  window_end?: string;
  units: HubUnit[];
  announcements: UnitAnnouncement[];
  sessions: LearningSession[];
}

export type AnnouncementInput = Pick<
  UnitAnnouncement,
  'title' | 'body' | 'published_at' | 'expires_at' | 'source_url' | 'pinned'
>;
export type SessionInput = Pick<
  LearningSession,
  | 'title'
  | 'description'
  | 'kind'
  | 'start_at'
  | 'end_at'
  | 'timezone'
  | 'join_url'
  | 'location'
  | 'source_url'
  | 'published'
  | 'cancelled'
  | 'recurrence'
  | 'recurrence_until'
>;

export const SESSION_KINDS: {value: SessionKind; label: string; icon: string}[] = [
  {value: 'helphub', label: 'HelpHub', icon: 'support_agent'},
  {value: 'lecture', label: 'Lecture', icon: 'cast_for_education'},
  {value: 'seminar', label: 'Seminar', icon: 'groups'},
  {value: 'workshop', label: 'Workshop', icon: 'construction'},
  {value: 'other', label: 'Class or event', icon: 'event'},
];
