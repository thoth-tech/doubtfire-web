import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';

export interface NotificationFeedbackRouteTarget {
  projectId: number;
  taskAbbreviation: string;
}

export interface NotificationFeedbackRouteIntent extends NotificationFeedbackRouteTarget {
  requestId: number;
}

/**
 * Carries a validated feedback-route intent until the project resolves its
 * task definition.
 *
 * Notification links contain the public task abbreviation, while Batch 02's
 * conversation hook deliberately accepts the internal task-definition id. A
 * small one-shot coordinator keeps either layer from guessing the other's
 * identity and also handles a click on the feedback route that is already open.
 */
@Injectable({providedIn: 'root'})
export class NotificationFeedbackRouteIntentService {
  private nextRequestId = 0;
  private pendingIntent: NotificationFeedbackRouteIntent | null = null;
  private readonly requestSubject: Subject<NotificationFeedbackRouteIntent> = new Subject();

  readonly requests$: Observable<NotificationFeedbackRouteIntent> =
    this.requestSubject.asObservable();

  request(target: NotificationFeedbackRouteTarget): NotificationFeedbackRouteIntent {
    const request: NotificationFeedbackRouteIntent = {
      ...target,
      requestId: ++this.nextRequestId,
    };
    this.pendingIntent = request;
    this.requestSubject.next(request);
    return request;
  }

  consume(target: NotificationFeedbackRouteTarget): NotificationFeedbackRouteIntent | null {
    if (!this.matches(this.pendingIntent, target)) {
      return null;
    }

    const request = this.pendingIntent;
    this.pendingIntent = null;
    return request;
  }

  cancel(request: NotificationFeedbackRouteIntent): void {
    if (this.pendingIntent?.requestId === request.requestId) {
      this.pendingIntent = null;
    }
  }

  clear(): void {
    this.pendingIntent = null;
  }

  private matches(
    request: NotificationFeedbackRouteIntent | null,
    target: NotificationFeedbackRouteTarget,
  ): request is NotificationFeedbackRouteIntent {
    return (
      request?.projectId === target.projectId &&
      request.taskAbbreviation === target.taskAbbreviation
    );
  }
}
