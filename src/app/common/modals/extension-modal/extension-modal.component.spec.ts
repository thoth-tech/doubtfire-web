import {describe, expect, it, vi} from 'vitest';
import {ExtensionModalComponent} from './extension-modal.component';

// scrollCommentsDown reaches into the DOM for div.comments-body, which is not
// mounted on every screen the modal can open from. Exercise it on a bare
// instance with no such element present.
describe('ExtensionModalComponent scrollCommentsDown', () => {
  it('does not throw when the comments panel is not on the page', () => {
    vi.useFakeTimers();
    const component = Object.create(ExtensionModalComponent.prototype) as {
      scrollCommentsDown(): void;
    };

    expect(() => {
      component.scrollCommentsDown();
      vi.runAllTimers();
    }).not.toThrow();

    vi.useRealTimers();
  });
});
