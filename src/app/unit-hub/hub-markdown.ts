import DOMPurify from 'dompurify';
import {Marked, Tokens} from 'marked';
import {Pipe, PipeTransform, inject} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

/** Basic formatting only. No images, frames, styles or event handlers. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
  'blockquote',
  'code',
  'pre',
  'a',
  'hr',
];

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// A private instance, so these options never change the app-wide marked pipe.
const hubMarked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  walkTokens(token) {
    // headings sit under the dialog title, so the scale starts at h3
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading;
      heading.depth = Math.min(4, Math.max(3, heading.depth));
    }
  },
  renderer: {
    // Bodies are stored as plain text. Typed HTML shows as the characters typed.
    html({text}: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    image({text}: Tokens.Image) {
      return escapeHtml(text);
    },
  },
});

function sanitizedFragment(markdown: string | null | undefined): DocumentFragment {
  const html = hubMarked.parse(markdown ?? '', {async: false}) as string;
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https:|mailto:)/i,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const link of Array.from(fragment.querySelectorAll('a'))) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  return fragment;
}

/** Markdown to sanitised HTML with basic formatting and links that open in a new tab. */
export function renderHubMarkdown(markdown: string | null | undefined): string {
  const holder = document.createElement('div');
  holder.appendChild(sanitizedFragment(markdown));
  return holder.innerHTML;
}

const BLOCKS = 'p, li, h3, h4, blockquote, pre, hr';

/** Markdown to one line of plain text, for card excerpts. */
export function hubMarkdownToText(markdown: string | null | undefined): string {
  const fragment = sanitizedFragment(markdown);
  for (const br of Array.from(fragment.querySelectorAll('br'))) {
    br.replaceWith(' ');
  }
  for (const block of Array.from(fragment.querySelectorAll(BLOCKS))) {
    block.append(' ');
  }
  return (fragment.textContent ?? '').replace(/\s+/g, ' ').trim();
}

@Pipe({name: 'hubMarkdown', standalone: true})
export class HubMarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(markdown: string | null | undefined): SafeHtml {
    // DOMPurify has already reduced this to the allowed tags and attributes above.
    return this.sanitizer.bypassSecurityTrustHtml(renderHubMarkdown(markdown));
  }
}

@Pipe({name: 'hubPlainText', standalone: true})
export class HubPlainTextPipe implements PipeTransform {
  transform(markdown: string | null | undefined): string {
    return hubMarkdownToText(markdown);
  }
}
