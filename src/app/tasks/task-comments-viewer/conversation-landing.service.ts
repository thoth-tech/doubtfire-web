import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';

/**
 * A route-agnostic identity for one task conversation.
 *
 * Notification routing owns how it reaches a task. Once that task has resolved,
 * it can hand this service the same stable identity the comments viewer uses.
 * Keeping route strings and notification records out of this contract prevents
 * the feedback feature from becoming a second routing implementation.
 */
export interface ConversationLandingTarget {
  projectId: number;
  taskDefinitionId: number;
}

export interface ConversationLandingRequest extends ConversationLandingTarget {
  requestId: number;
}

@Injectable({providedIn: 'root'})
export class ConversationLandingService {
  private nextRequestId = 0;
  private pendingRequest: ConversationLandingRequest | null = null;
  private readonly requestSubject: Subject<ConversationLandingRequest> = new Subject();

  /** Emits new requests for a viewer that is already mounted and ready. */
  public readonly requests$: Observable<ConversationLandingRequest> =
    this.requestSubject.asObservable();

  /**
   * Request a one-shot landing at the newest messages and composer.
   *
   * Only the latest unfulfilled navigation intent is retained. A request made
   * before the destination viewer exists remains pending until that exact
   * conversation reports that it has revealed its fresh history.
   */
  public requestLatestMessages(target: ConversationLandingTarget): ConversationLandingRequest {
    const request: ConversationLandingRequest = {
      projectId: target.projectId,
      taskDefinitionId: target.taskDefinitionId,
      requestId: ++this.nextRequestId,
    };

    this.pendingRequest = request;
    this.requestSubject.next(request);
    return request;
  }

  /** Returns the pending request only when it belongs to this conversation. */
  public pendingFor(target: ConversationLandingTarget): ConversationLandingRequest | null {
    return this.matches(this.pendingRequest, target) ? this.pendingRequest : null;
  }

  /**
   * Complete a request after the reveal has actually happened.
   *
   * Comparing the request id prevents a late viewer from clearing a newer
   * intent that happens to point at the same task.
   */
  public complete(request: ConversationLandingRequest): void {
    if (this.pendingRequest?.requestId === request.requestId) {
      this.pendingRequest = null;
    }
  }

  /** Lets a caller retire an intent if its navigation fails or is cancelled. */
  public cancel(request: ConversationLandingRequest): void {
    this.complete(request);
  }

  private matches(
    request: ConversationLandingRequest | null,
    target: ConversationLandingTarget,
  ): request is ConversationLandingRequest {
    return (
      request?.projectId === target.projectId &&
      request.taskDefinitionId === target.taskDefinitionId
    );
  }
}
