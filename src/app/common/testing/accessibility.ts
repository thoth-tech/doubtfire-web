import axe, {AxeResults} from 'axe-core';

/**
 * Check a rendered, attached fixture after Angular's fixture.whenStable().
 * Await this helper with real timers; axe runs asynchronously.
 *
 * This is a DOM regression check, not a complete WCAG audit. jsdom cannot
 * measure layout or colour contrast, so color-contrast is the only disabled
 * rule. Keep contrast-math tests and manual browser checks alongside it.
 * https://github.com/dequelabs/axe-core#supported-browsers
 *
 * Incomplete results need manual review and remain available in the return
 * value. No violation baseline or severity filter hides newly detected issues.
 */
export async function expectAccessible(element: HTMLElement): Promise<AxeResults> {
  if (!element?.isConnected) {
    throw new Error('Accessibility checks require a rendered element attached to the document.');
  }

  const results = await axe.run(element, {
    // Inspect local fixture styles only; never fetch external stylesheets/media.
    preload: false,
    rules: {'color-contrast': {enabled: false}},
  });

  if (results.violations.length > 0) {
    const failures = results.violations.map((violation) => {
      const targets = violation.nodes.map((node) => JSON.stringify(node.target)).join(', ');
      return `${violation.id} (${violation.impact}): ${violation.help}\n  Targets: ${targets}`;
    });
    // Report selectors and rule names without logging fixture HTML or user data.
    throw new Error(`Accessibility violations:\n${failures.join('\n')}`);
  }

  return results;
}
