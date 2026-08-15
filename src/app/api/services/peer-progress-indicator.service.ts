import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {PeerProgressIndicator} from '../models/peer-progress-indicator';
import {
  DISABLED_STATE,
  NORMAL_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  ZERO_PERCENT_STATE,
} from './mock/peer-progress-indicator.mock';

@Injectable({
  providedIn: 'root',
})
export class PeerProgressIndicatorService {
  constructor() {}

  // At the moment, it returns mock PPI data for the given state. In future, this will call the real backend API.

  getIndicator(
    taskDefinitionId: number,
    unitId: number,
    targetGrade: number,
    state: 'normal' | 'zero' | 'suppressed' | 'unavailable' | 'stale' | 'disabled',
  ): Observable<PeerProgressIndicator> {
    const base = this.resolveState(state);

    return of({
      ...base,
      taskDefinitionId,
      unitId,
      targetGrade,
    });
  }

  private resolveState(state: string): PeerProgressIndicator {
    switch (state) {
      case 'normal':
        return NORMAL_STATE;
      case 'zero':
        return ZERO_PERCENT_STATE;
      case 'suppressed':
        return SUPPRESSED_STATE;
      case 'unavailable':
        return UNAVAILABLE_STATE;
      case 'stale':
        return STALE_STATE;
      case 'disabled':
        return DISABLED_STATE;
      default:
        return UNAVAILABLE_STATE;
    }
  }
}
