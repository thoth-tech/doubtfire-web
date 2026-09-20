export interface PeerMedianPoint {
  date: string;

  /**
   * Median proportion of target task weight still remaining across the cohort,
   * from 0 to 1. This matches the scale used by the existing burndown series
   * before those values are converted into percentages for display.
   */
  remaining: number;
}

/**
 * A safe display state returned by the authorised backend or frontend adapter.
 *
 * The browser must not receive a raw cohort size and decide whether a cohort is
 * large enough. That privacy decision belongs at the trusted data boundary.
 */
export type PeerProgressState = 'ready' | 'suppressed' | 'unavailable' | 'disabled';

export interface PeerProgressResponse {
  project_id: number;

  /** The comparison applies to this selected target grade. */
  target_grade: number;

  /** Privacy-safe state; no raw cohort size is returned to the component. */
  state: PeerProgressState;

  /**
   * Anonymous median points. This must be empty unless state is ready.
   */
  median_burndown: PeerMedianPoint[];
}
