import {beforeEach, describe, expect, it} from 'vitest';
import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PageContainerComponent} from './page-container.component';

@Component({
  templateUrl: './page-container.component.spec.html',
  standalone: false,
})
class PageContainerTestHostComponent {
  fullWidth = false;
}

describe('PageContainerComponent', () => {
  let fixture: ComponentFixture<PageContainerTestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PageContainerComponent, PageContainerTestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageContainerTestHostComponent);
    fixture.detectChanges();
  });

  it('renders a block-level constrained container with projected content', () => {
    const host: HTMLElement = fixture.nativeElement.querySelector('f-page-container');
    const container: HTMLElement = host.querySelector(':scope > div');

    expect(host.classList.contains('block')).toBe(true);
    expect(host.classList.contains('w-full')).toBe(true);
    expect(new Set(container.classList)).toEqual(
      new Set([
        'page-container',
        'mx-auto',
        'w-full',
        'px-4',
        'sm:px-6',
        'lg:px-8',
        'max-w-screen-xl',
      ]),
    );
    expect(container.querySelector('[data-testid="projected-content"]')?.textContent).toContain(
      'Projected content',
    );
  });

  it('removes the width constraint while retaining responsive padding', () => {
    const pageContainerFixture = TestBed.createComponent(PageContainerComponent);
    pageContainerFixture.componentRef.setInput('fullWidth', true);
    pageContainerFixture.detectChanges();

    const container: HTMLElement = pageContainerFixture.nativeElement.querySelector('div');

    expect(new Set(container.classList)).toEqual(
      new Set(['page-container', 'mx-auto', 'w-full', 'px-4', 'sm:px-6', 'lg:px-8']),
    );
  });
});
