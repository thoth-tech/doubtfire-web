import {afterEach, describe, expect, it, vi} from 'vitest';
import {UserIconComponent} from './user-icon.component';

describe('UserIconComponent outside a secure context', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('still resolves the background without SubtleCrypto', async () => {
    vi.stubGlobal('crypto', {});
    const component = new UserIconComponent({currentUser: null} as never);
    component.user = {email: 'demo@example.com', name: 'Demo Student'} as never;

    const url = await (
      component as unknown as {backgroundUrl: () => Promise<string | null>}
    ).backgroundUrl();

    expect(url).toBeNull();
  });
});
