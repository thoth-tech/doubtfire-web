import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {EmptyStateComponent} from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the icon, heading and message it is given', () => {
    component.icon = 'inbox';
    component.heading = 'Nothing here yet';
    component.message = 'New items will show up in this list.';
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('mat-icon').textContent.trim()).toBe('inbox');
    expect(root.textContent).toContain('Nothing here yet');
    expect(root.textContent).toContain('New items will show up in this list.');
  });

  it('renders the message and hint when there is no heading', () => {
    component.icon = 'inbox';
    component.message = 'Nothing here yet';
    component.hint = 'New items will show up in this list.';
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('mat-icon').textContent.trim()).toBe('inbox');
    expect(root.textContent).toContain('Nothing here yet');
    expect(root.textContent).toContain('New items will show up in this list.');
  });

  it('renders no action when no action label is given', () => {
    component.icon = 'inbox';
    component.heading = 'Nothing here yet';
    component.message = 'New items will show up in this list.';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the action and emits it on click, only when a label is given', () => {
    component.icon = 'inbox';
    component.heading = 'Nothing here yet';
    component.message = 'New items will show up in this list.';
    component.actionLabel = 'Refresh';
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Refresh');

    const emitted = vi.fn();
    component.action.subscribe(emitted);
    button.click();

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('marks the icon decorative so it is not announced twice alongside the heading', () => {
    component.icon = 'inbox';
    component.heading = 'Nothing here yet';
    component.message = 'New items will show up in this list.';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-icon').getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
