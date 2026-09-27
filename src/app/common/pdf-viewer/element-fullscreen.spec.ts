import {describe, expect, it, vi} from 'vitest';
import {ElementFullscreen} from './element-fullscreen';

/** Enough of the Fullscreen API for ElementFullscreen, which jsdom does not have. */
function fakeDocument(enabled = true) {
  const doc = {
    fullscreenEnabled: enabled,
    fullscreenElement: null as Element | null,
    exitFullscreen: vi.fn(() => {
      doc.fullscreenElement = null;
      return Promise.resolve();
    }),
  };
  return doc;
}

function fakeElement(doc: ReturnType<typeof fakeDocument>) {
  const element = document.createElement('div');
  element.requestFullscreen = vi.fn(() => {
    doc.fullscreenElement = element;
    return Promise.resolve();
  });
  return element;
}

describe('ElementFullscreen, the PDF viewer full screen', () => {
  it('reports whether the browser can go full screen', () => {
    const element = document.createElement('div');

    expect(new ElementFullscreen(() => element, fakeDocument(true) as never).supported).toBe(true);
    expect(new ElementFullscreen(() => element, fakeDocument(false) as never).supported).toBe(
      false,
    );
  });

  it('asks the browser to put the viewer full screen, then leaves it on the next toggle', async () => {
    const doc = fakeDocument();
    const element = fakeElement(doc);
    const fullscreen = new ElementFullscreen(() => element, doc as never);

    expect(fullscreen.active).toBe(false);

    await fullscreen.toggle();
    expect(element.requestFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen.active).toBe(true);

    await fullscreen.toggle();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen.active).toBe(false);
  });

  it('is not active when something else on the page holds full screen', async () => {
    const doc = fakeDocument();
    const element = fakeElement(doc);
    const fullscreen = new ElementFullscreen(() => element, doc as never);
    doc.fullscreenElement = document.createElement('video');

    expect(fullscreen.active).toBe(false);

    fullscreen.release();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });

  it('passes a refusal back to the caller', async () => {
    const doc = fakeDocument();
    const element = document.createElement('div');
    element.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
    const fullscreen = new ElementFullscreen(() => element, doc as never);

    await expect(fullscreen.toggle()).rejects.toThrow('denied');
    expect(fullscreen.active).toBe(false);
  });

  it('releases full screen when the viewer goes away', async () => {
    const doc = fakeDocument();
    const element = fakeElement(doc);
    const fullscreen = new ElementFullscreen(() => element, doc as never);
    await fullscreen.toggle();

    fullscreen.release();

    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
  });
});
