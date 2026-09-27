import {describe, expect, it} from 'vitest';
import {hubMarkdownToText, renderHubMarkdown} from './hub-markdown';

const dom = (html: string) => {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder;
};

describe('Unit Hub markdown', () => {
  it('renders basic formatting', () => {
    const html = dom(
      renderHubMarkdown('# Week 3\n\n**Bring** *questions*\n\n- one\n- two\n\n> note\n\n`code`'),
    );
    expect(html.querySelector('h3')?.textContent).toBe('Week 3');
    expect(html.querySelector('h1, h2')).toBeNull();
    expect(html.querySelector('strong')?.textContent).toBe('Bring');
    expect(html.querySelector('em')?.textContent).toBe('questions');
    expect(html.querySelectorAll('li')).toHaveLength(2);
    expect(html.querySelector('blockquote')).not.toBeNull();
    expect(html.querySelector('code')?.textContent).toBe('code');
  });

  it('strips scripts, images, frames, styles and event handlers', () => {
    const html = dom(
      renderHubMarkdown(
        'Hi <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n![pic](https://example.test/a.png)\n\n<iframe src="https://example.test"></iframe>\n\n<p style="color:red" onclick="alert(1)">x</p>',
      ),
    );
    expect(html.querySelector('script, img, iframe, [style], [onclick], [onerror]')).toBeNull();
    // typed HTML is kept as the characters typed
    expect(html.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(html.textContent).toContain('pic');
  });

  it('opens links in a new tab and drops unsafe schemes', () => {
    const html = dom(
      renderHubMarkdown(
        '[Guide](https://example.test/guide) [Bad](javascript:alert(1)) [Mail](mailto:help@example.test)',
      ),
    );
    const links = Array.from(html.querySelectorAll('a'));
    const guide = links.find((link) => link.textContent === 'Guide');
    expect(guide?.getAttribute('href')).toBe('https://example.test/guide');
    expect(guide?.getAttribute('target')).toBe('_blank');
    expect(guide?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      links.find((link) => link.textContent === 'Bad')?.getAttribute('href') ?? null,
    ).toBeNull();
    expect(html.innerHTML).not.toContain('javascript:');
    for (const link of links) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('turns markdown into plain excerpt text without formatting symbols', () => {
    const text = hubMarkdownToText(
      '## Heading\n\n**Bold** and *italic* with `code`\n\n- first\n- second\n\n[Link](https://example.test)',
    );
    expect(text).toBe('Heading Bold and italic with code first second Link');
    expect(text).not.toMatch(/[*#`[\]]/);
    expect(hubMarkdownToText(null)).toBe('');
  });
});
