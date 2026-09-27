import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TaskStatusSeenService, TaskStatusSnapshot} from './task-status-seen.service';

describe('TaskStatusSeenService', () => {
  let service: TaskStatusSeenService;

  const snapshot = (taskDefinitionId: number, status: TaskStatusSnapshot['status']) => ({
    taskDefinitionId,
    status,
  });

  let store: Map<string, string>;
  let storage: {getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    store = new Map();
    storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => void store.set(key, value)),
    };
    vi.stubGlobal('localStorage', storage);
    service = new TaskStatusSeenService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a key scoped to the user and the project', () => {
    expect(service.storageKey(5, 12)).toBe('ontrack.taskStatusSeen.5.12');
  });

  it('treats a first visit as silent, with nothing to celebrate', () => {
    const changes = service.detectChanges(5, 12, [snapshot(1, 'complete'), snapshot(2, 'discuss')]);

    expect(changes.firstVisit).toBe(true);
    expect(changes.completed).toEqual([]);
    expect(changes.readyToDiscuss).toEqual([]);
  });

  it('detects tasks that became complete since the last visit', () => {
    service.record(5, 12, [
      snapshot(1, 'ready_for_feedback'),
      snapshot(2, 'complete'),
      snapshot(3, 'working_on_it'),
      snapshot(4, 'ready_for_feedback'),
      snapshot(5, 'ready_for_feedback'),
    ]);

    const changes = service.detectChanges(5, 12, [
      snapshot(1, 'complete'),
      snapshot(2, 'complete'),
      snapshot(3, 'working_on_it'),
      snapshot(4, 'discuss'),
      snapshot(5, 'fix_and_resubmit'),
    ]);

    expect(changes.firstVisit).toBe(false);
    expect(changes.completed).toEqual([1]);
    expect(changes.readyToDiscuss).toEqual([4]);
    expect(changes.needsChanges).toEqual([5]);
    expect(changes.previous['1']).toBe('ready_for_feedback');
  });

  it('plays once, because recording the new statuses clears the change', () => {
    service.record(5, 12, [snapshot(1, 'ready_for_feedback')]);
    const current = [snapshot(1, 'complete')];

    expect(service.detectChanges(5, 12, current).completed).toEqual([1]);
    service.record(5, 12, current);
    expect(service.detectChanges(5, 12, current).completed).toEqual([]);
  });

  it('keeps each user and project apart', () => {
    service.record(5, 12, [snapshot(1, 'ready_for_feedback')]);

    expect(service.detectChanges(6, 12, [snapshot(1, 'complete')]).firstVisit).toBe(true);
    expect(service.detectChanges(5, 13, [snapshot(1, 'complete')]).firstVisit).toBe(true);
    expect(service.detectChanges(5, 12, [snapshot(1, 'complete')]).completed).toEqual([1]);
  });

  it('reads as a first visit and never throws when storage is unavailable', () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('blocked');
    });
    storage.setItem.mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => service.detectChanges(5, 12, [snapshot(1, 'complete')])).not.toThrow();
    expect(service.detectChanges(5, 12, [snapshot(1, 'complete')]).firstVisit).toBe(true);
    expect(service.record(5, 12, [snapshot(1, 'complete')])).toBe(false);
  });

  it('ignores corrupt stored data and unknown statuses', () => {
    store.set(service.storageKey(5, 12), '{not json');
    expect(service.read(5, 12)).toBeNull();

    store.set(service.storageKey(5, 12), JSON.stringify({'1': 'complete', '2': 'made_up'}));
    expect(service.read(5, 12)).toEqual({'1': 'complete'});
  });

  it('does nothing without a signed-in user or a project', () => {
    expect(service.record(0, 12, [snapshot(1, 'complete')])).toBe(false);
    expect(service.detectChanges(Number.NaN, 12, []).firstVisit).toBe(true);
  });
});
