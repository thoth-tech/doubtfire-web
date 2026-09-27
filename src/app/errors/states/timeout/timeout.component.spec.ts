import {describe, expect, it, vi} from 'vitest';
import {TimeoutComponent} from './timeout.component';

describe('TimeoutComponent', () => {
  it('signs in again immediately when the user asks to', () => {
    const auth = {signOut: vi.fn()};
    const component = new TimeoutComponent(auth as never);

    component.signInAgain();

    expect(auth.signOut).toHaveBeenCalledWith(false);
  });

  it('does not sign the user out twice after they act', () => {
    vi.useFakeTimers();
    const auth = {signOut: vi.fn()};
    const component = new TimeoutComponent(auth as never);

    component.ngOnInit();
    component.signInAgain();
    vi.runAllTimers();

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
