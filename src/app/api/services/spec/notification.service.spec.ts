import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  HttpRequest,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import API_URL from 'src/app/config/constants/apiUrl';
import {Notification} from '../../models/notification';
import {NotificationService} from '../notification.service';

const LIST_URL = `${API_URL}/notifications/`;
const COUNT_URL = `${API_URL}/notifications/unread_count`;
const READ_ALL_URL = `${API_URL}/notifications/read_all`;
const DELETE_ALL_URL = `${API_URL}/notifications`;

/**
 * What NotificationEntity actually puts on the wire. Snake case, and read_at is
 * null rather than absent while a notification is unread.
 */
function unreadJson(id = 1) {
  return {
    id,
    notification_type: 'task',
    event: 'task_due_soon',
    message: 'Jane commented on Task 1.1P',
    link: '/#/projects/1/task/2',
    read_at: null,
    created_at: '2026-08-09T04:12:00.000Z',
  };
}

function readJson(id = 1, readAt = '2026-08-09T05:00:00.000Z') {
  return {...unreadJson(id), read_at: readAt};
}

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        NotificationService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // A cancelled request is still open as far as the backend is concerned, and
    // reset() cancels on purpose. The tests that call it assert the
    // cancellation themselves. Nothing is lost by ignoring them here: a request
    // cancelled by accident still fails, because the flush that was expecting
    // it throws rather than being skipped.
    httpMock.verify({ignoreCancelled: true});
  });

  /**
   * Read whatever unreadCount$ is holding right now. It is a BehaviorSubject so
   * this emits synchronously.
   */
  function currentUnreadCount(): number {
    let count: number;
    service.unreadCount$.subscribe((value) => (count = value)).unsubscribe();
    return count;
  }

  /**
   * Put a known count on the subject so the tests below can assert a movement
   * rather than an absolute value.
   */
  function seedUnreadCount(count: number): void {
    service.refreshUnreadCount().subscribe();
    httpMock.expectOne(COUNT_URL).flush({count});
  }

  /**
   * Answer the authoritative count re-read that every mutation fires. Leaving it
   * unflushed fails the httpMock.verify() in afterEach, which is the point: the
   * resync is part of the contract, not an optimisation a change can quietly
   * drop.
   */
  function flushResync(count: number): void {
    httpMock.expectOne(COUNT_URL).flush({count});
  }

  /**
   * Put a list in the cache so cache behaviour can be asserted against it.
   */
  function primeCache(...rows: object[]): Notification[] {
    let listed: Notification[];
    service.list().subscribe((notifications) => (listed = notifications));
    httpMock.expectOne(LIST_URL).flush(rows);
    return listed;
  }

  describe('list', () => {
    it('gets every notification and maps the entity', () => {
      let result: Notification[];

      service.list().subscribe((notifications) => (result = notifications));

      const req = httpMock.expectOne((request: HttpRequest<object>): boolean => {
        expect(request.url).toEqual(LIST_URL);
        expect(request.method).toBe('GET');
        expect(request.params.has('unread_only')).toBe(false);
        return true;
      });
      req.flush([unreadJson()]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        notificationType: 'task',
        event: 'task_due_soon',
        message: 'Jane commented on Task 1.1P',
        link: '/#/projects/1/task/2',
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('reports an unread notification as unread', () => {
      const listed = primeCache(unreadJson());

      // read_at comes back null. new Date(null) is the epoch and would read as
      // truthy, so this fails if the mapping ever goes back to mapDate.
      expect(listed[0].readAt).toBeNull();
      expect(listed[0].isRead).toBe(false);
    });

    it('updates the same entity objects on a second call instead of rebuilding them', () => {
      const first = primeCache(unreadJson(1));
      const second = primeCache(readJson(1));

      // Same instance, not just equal. fetchAll only reuses cached entities when
      // options.cache is passed, so this fails the moment that is dropped, and a
      // component holding the first array would silently go stale.
      expect(second[0]).toBe(first[0]);
      expect(first[0].isRead).toBe(true);
    });

    it('evicts rows the server no longer returns', () => {
      primeCache(unreadJson(1), unreadJson(2));
      expect(service.cache.size).toBe(2);

      primeCache(unreadJson(1));

      // fetchAll only ever adds. Without the eviction pass a notification
      // deleted in another tab would sit in the cache for the rest of the
      // session and markAllRead would walk over a row that is gone.
      expect(service.cache.size).toBe(1);
    });

    it('does not evict when only unread rows were asked for', () => {
      primeCache(unreadJson(1), readJson(2));
      expect(service.cache.size).toBe(2);

      service.list(true).subscribe();
      httpMock
        .expectOne((request: HttpRequest<object>): boolean => {
          expect(request.url).toEqual(LIST_URL);
          expect(request.params.get('unread_only')).toBe('true');
          return true;
        })
        .flush([unreadJson(1)]);

      // Notification 2 is missing because it is read, not because it is gone.
      expect(service.cache.size).toBe(2);
    });
  });

  describe('refreshUnreadCount', () => {
    it('gets the count and pushes it to unreadCount$', () => {
      let emitted: number;

      service.refreshUnreadCount().subscribe((count) => (emitted = count));

      const req = httpMock.expectOne((request: HttpRequest<object>): boolean => {
        expect(request.url).toEqual(COUNT_URL);
        expect(request.method).toBe('GET');
        return true;
      });
      req.flush({count: 7});

      expect(emitted).toBe(7);
      expect(currentUnreadCount()).toBe(7);
    });

    it('ignores an older count response that lands after a newer one', () => {
      service.refreshUnreadCount().subscribe();
      service.refreshUnreadCount().subscribe();

      const requests = httpMock.match(COUNT_URL);
      expect(requests).toHaveLength(2);

      // The second request answers first.
      requests[1].flush({count: 4});
      expect(currentUnreadCount()).toBe(4);

      // Then the first one answers, carrying the number from before whatever
      // triggered the second. Nothing orders http responses, so without the
      // sequence guard this overwrites a correct count with a stale one and the
      // bell stays wrong until the next mutation.
      requests[0].flush({count: 9});

      expect(currentUnreadCount()).toBe(4);
    });

    it('ignores a count response older than a local change to the count', () => {
      seedUnreadCount(5);

      // In flight before the mutation, so its answer was computed without it.
      service.refreshUnreadCount().subscribe();
      const stale = httpMock.expectOne(COUNT_URL);

      const notification = new Notification();
      notification.id = 4;
      notification.readAt = null;
      service.markRead(notification).subscribe();
      httpMock.expectOne(`${API_URL}/notifications/4/read`).flush(readJson(4));

      expect(currentUnreadCount()).toBe(4);

      // The local decrement is newer than that request, so it has to retire it.
      // Guarding only response against response leaves this hole open, and it
      // is the common one: every mutation starts a count request.
      stale.flush({count: 5});

      expect(currentUnreadCount()).toBe(4);

      flushResync(4);
    });
  });

  describe('markRead', () => {
    it('puts to the read endpoint and drops the unread count by one', () => {
      seedUnreadCount(3);

      const notification = new Notification();
      notification.id = 4;
      notification.readAt = null;

      let result: Notification;
      service.markRead(notification).subscribe((updated) => (result = updated));

      const req = httpMock.expectOne((request: HttpRequest<object>): boolean => {
        expect(request.url).toEqual(`${API_URL}/notifications/4/read`);
        expect(request.method).toBe('PUT');
        return true;
      });
      req.flush(readJson(4));

      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeInstanceOf(Date);
      expect(currentUnreadCount()).toBe(2);

      flushResync(2);
    });

    it('leaves the count alone when the notification was already read', () => {
      seedUnreadCount(3);

      const notification = new Notification();
      notification.id = 4;
      notification.readAt = new Date('2026-08-09T05:00:00.000Z');

      service.markRead(notification).subscribe();
      httpMock.expectOne(`${API_URL}/notifications/4/read`).flush(readJson(4));

      // mark_read! is a no-op on the api for one already read, so decrementing
      // here would push the bell below the real number.
      expect(currentUnreadCount()).toBe(3);

      flushResync(3);
    });

    it('lets the server correct the count when two calls race on the same row', () => {
      seedUnreadCount(2);

      const notification = new Notification();
      notification.id = 4;
      notification.readAt = null;

      service.markRead(notification).subscribe();
      service.markRead(notification).subscribe();

      const puts = httpMock.match(`${API_URL}/notifications/4/read`);
      expect(puts).toHaveLength(2);
      puts.forEach((req) => req.flush(readJson(4)));

      // Both captured the row as unread before either answered, so both
      // subtracted one and the local number is now one below the truth. This is
      // the known limit of local arithmetic, asserted rather than pretended away.
      expect(currentUnreadCount()).toBe(0);

      const resyncs = httpMock.match(COUNT_URL);
      expect(resyncs).toHaveLength(2);
      resyncs.forEach((req) => req.flush({count: 1}));

      // And this is why every mutation re-reads it.
      expect(currentUnreadCount()).toBe(1);
    });
  });

  describe('markAllRead', () => {
    it('puts to read_all, zeroes the count and corrects the cached rows', () => {
      seedUnreadCount(2);

      const listed = primeCache(unreadJson(1), unreadJson(2));
      expect(listed.every((notification) => !notification.isRead)).toBe(true);

      service.markAllRead().subscribe();

      const req = httpMock.expectOne((request: HttpRequest<object>): boolean => {
        expect(request.url).toEqual(READ_ALL_URL);
        expect(request.method).toBe('PUT');
        return true;
      });
      req.flush({success: true});

      expect(currentUnreadCount()).toBe(0);
      // read_all answers {success: true} and not entities, so nothing corrects
      // the cache unless the service does it. Without this the bell reads zero
      // while every row still draws as unread.
      expect(listed.every((notification) => notification.isRead)).toBe(true);

      flushResync(0);
    });

    it('announces the corrected rows on the cache observable', () => {
      primeCache(unreadJson(1), unreadJson(2));

      let emissions = 0;
      let latest: Notification[];
      const subscription = service.cache.values.subscribe((values) => {
        emissions++;
        latest = values;
      });
      const emissionsBefore = emissions;

      service.markAllRead().subscribe();
      httpMock.expectOne(READ_ALL_URL).flush({success: true});

      // Assigning readAt announces nothing on its own. Only EntityCache.set
      // calls updateCacheArray, so an OnPush list bound to cache.values would
      // never redraw without it.
      expect(emissions).toBeGreaterThan(emissionsBefore);
      expect(latest.every((notification) => notification.isRead)).toBe(true);

      subscription.unsubscribe();
      flushResync(0);
    });
  });

  describe('remove', () => {
    it('deletes the notification and drops the unread count by one', () => {
      seedUnreadCount(3);

      const notification = new Notification();
      notification.id = 9;
      notification.readAt = null;

      service.remove(notification).subscribe();

      const req = httpMock.expectOne((request: HttpRequest<object>): boolean => {
        expect(request.url).toEqual(`${API_URL}/notifications/9`);
        expect(request.method).toBe('DELETE');
        return true;
      });
      req.flush({success: true});

      expect(currentUnreadCount()).toBe(2);

      flushResync(2);
    });

    it('leaves the count alone when deleting one that was already read', () => {
      seedUnreadCount(3);

      const notification = new Notification();
      notification.id = 9;
      notification.readAt = new Date('2026-08-09T05:00:00.000Z');

      service.remove(notification).subscribe();
      httpMock.expectOne(`${API_URL}/notifications/9`).flush({success: true});

      expect(currentUnreadCount()).toBe(3);

      flushResync(3);
    });

    it('evicts the deleted notification from the cache', () => {
      primeCache(unreadJson(1), unreadJson(2));

      const target = service.cache.currentValues.find((notification) => notification.id === 2);

      service.remove(target).subscribe();
      httpMock.expectOne(`${API_URL}/notifications/2`).flush({success: true});

      expect(service.cache.size).toBe(1);
      expect(service.cache.currentValues[0].id).toBe(1);

      flushResync(0);
    });
  });

  describe('deleteAll', () => {
    it('deletes only through the confirmed id and evicts that snapshot', () => {
      seedUnreadCount(3);
      primeCache(unreadJson(3), readJson(4), unreadJson(5));

      let deletedCount: number;
      service.deleteAll(4).subscribe((count) => (deletedCount = count));

      const request = httpMock.expectOne((candidate: HttpRequest<object>): boolean => {
        expect(candidate.url).toBe(DELETE_ALL_URL);
        expect(candidate.method).toBe('DELETE');
        expect(candidate.params.get('through_id')).toBe('4');
        return true;
      });
      request.flush({success: true, deleted_count: 2});

      expect(deletedCount).toBe(2);
      expect(service.cache.currentValues.map((row) => row.id)).toEqual([5]);
      expect(currentUnreadCount()).toBe(2);

      flushResync(2);
    });

    it('does not evict or change the count when the request fails', () => {
      seedUnreadCount(2);
      primeCache(unreadJson(1), unreadJson(2));

      service.deleteAll(2).subscribe({error: () => undefined});
      httpMock
        .expectOne(
          (request: HttpRequest<object>) =>
            request.url === DELETE_ALL_URL && request.params.get('through_id') === '2',
        )
        .flush({error: 'failed'}, {status: 500, statusText: 'Server Error'});

      expect(service.cache.currentValues.map((row) => row.id)).toEqual([1, 2]);
      expect(currentUnreadCount()).toBe(2);
    });
  });

  describe('reset', () => {
    it('drops the cache and the unread count', () => {
      primeCache(unreadJson(1), unreadJson(2));
      seedUnreadCount(4);

      expect(service.cache.size).toBe(2);
      expect(currentUnreadCount()).toBe(4);

      service.reset();

      // The service is provided in root and sign out routes rather than
      // reloading, so without this the next person to sign in on a shared
      // machine starts with the previous person's messages and count.
      expect(service.cache.size).toBe(0);
      expect(currentUnreadCount()).toBe(0);
    });

    it('cancels a list still in flight so it cannot refill the cache', () => {
      let emitted = false;

      service.list().subscribe(() => (emitted = true));
      const pending = httpMock.expectOne(LIST_URL);

      service.reset();

      // Aborted, not merely ignored, and that distinction is the whole fix.
      // The cache write lives in a tap inside the base class, upstream of
      // anything this service could put a guard in, so the only way to stop it
      // is to make sure the response never arrives.
      expect(pending.cancelled).toBe(true);
      expect(emitted).toBe(false);
      expect(service.cache.size).toBe(0);
    });

    it('cancels a count re-sync still in flight so it cannot restore the count', () => {
      seedUnreadCount(5);

      const notification = new Notification();
      notification.id = 4;
      notification.readAt = null;

      service.markRead(notification).subscribe();
      httpMock.expectOne(`${API_URL}/notifications/4/read`).flush(readJson(4));
      expect(currentUnreadCount()).toBe(4);

      // Nobody holds this one. It is fired and forgotten by every mutation, so
      // it is the request most likely to be open when someone signs out.
      const resync = httpMock.expectOne(COUNT_URL);

      service.reset();

      expect(resync.cancelled).toBe(true);
      expect(currentUnreadCount()).toBe(0);
    });

    it('cancels a mark read still in flight so it cannot re-add the entity', () => {
      primeCache(unreadJson(1));

      const notification = service.cache.currentValues[0];
      service.markRead(notification).subscribe();
      const pending = httpMock.expectOne(`${API_URL}/notifications/1/read`);

      service.reset();

      // update() writes the response entity into the cache in a base class tap.
      // A sign out between the request and the response would otherwise leave
      // one of the previous user's notifications sitting in an empty cache.
      expect(pending.cancelled).toBe(true);
      expect(service.cache.size).toBe(0);
    });
  });
});
