/** Return only a visible, explicitly registered target on the current page. */
export function resolveOnboardingTarget(document: Document, name: string): HTMLElement | null {
  // Targets are compile-time ids, never CSS or HTML supplied by a user/storage.
  if (!/^[a-z-]+$/.test(name)) {
    return null;
  }
  for (const target of document.querySelectorAll<HTMLElement>(
    `[data-onboarding-target="${name}"]`,
  )) {
    const style = document.defaultView.getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    if (
      !target.closest('[hidden], [aria-hidden="true"], [inert]') &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    ) {
      return target;
    }
  }
  return null;
}
