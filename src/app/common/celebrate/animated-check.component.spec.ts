import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {AnimatedCheckComponent} from './animated-check.component';
import {CelebrationParticlesComponent} from './celebration-particles.component';

describe('AnimatedCheckComponent reduced motion', () => {
  const original = window.matchMedia;

  const mockMatchMedia = (reduce: boolean) => {
    (window as unknown as {matchMedia: unknown}).matchMedia = vi.fn((query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  };

  afterEach(() => {
    (window as unknown as {matchMedia: unknown}).matchMedia = original;
    TestBed.resetTestingModule();
  });

  it('draws normally when the viewer has not asked for less motion', () => {
    mockMatchMedia(false);
    const fixture = TestBed.createComponent(AnimatedCheckComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.reducedMotion).toBe(false);
    expect(fixture.nativeElement.classList.contains('reduced-motion')).toBe(false);
  });

  it('exposes the reduced motion flag and marks the host for the static end state', () => {
    mockMatchMedia(true);
    const fixture = TestBed.createComponent(AnimatedCheckComponent);
    fixture.componentRef.setInput('tone', 'primary');
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.reducedMotion).toBe(true);
    expect(host.classList.contains('reduced-motion')).toBe(true);
    expect(host.classList.contains('tone-primary')).toBe(true);
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to full motion when matchMedia is unavailable', () => {
    (window as unknown as {matchMedia: unknown}).matchMedia = undefined;
    const fixture = TestBed.createComponent(AnimatedCheckComponent);

    expect(fixture.componentInstance.reducedMotion).toBe(false);
  });

  it('renders no particles under reduced motion', () => {
    mockMatchMedia(true);
    const reduced = TestBed.createComponent(CelebrationParticlesComponent);
    reduced.detectChanges();
    expect(reduced.nativeElement.querySelectorAll('.particle').length).toBe(0);

    mockMatchMedia(false);
    const full = TestBed.createComponent(CelebrationParticlesComponent);
    full.detectChanges();
    expect(full.nativeElement.querySelectorAll('.particle').length).toBe(12);
  });
});
