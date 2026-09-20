import {describe, expect, it} from 'vitest';
import {MarkedPipe} from './marked.pipe';

describe('MarkedPipe', () => {
  it('create an instance', () => {
    const pipe = new MarkedPipe();
    expect(pipe).toBeTruthy();
  });

  it('renders a fenced code block as <pre>', () => {
    const pipe = new MarkedPipe();
    const html = pipe.transform('```\ncode\n```');
    expect(html).toContain('<pre>');
  });

  it('renders a markdown list as a <ul> with two items', () => {
    const pipe = new MarkedPipe();
    const html = pipe.transform('- a\n- b');
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) || []).length).toBe(2);
  });

  it('still turns a soft line break into a single <br>', () => {
    const pipe = new MarkedPipe();
    const html = pipe.transform('line1\nline2');
    expect((html.match(/<br\s*\/?>/g) || []).length).toBe(1);
  });
});
