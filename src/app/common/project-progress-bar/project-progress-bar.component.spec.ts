import {beforeEach, describe, expect, it} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {expectAccessible} from '../testing/accessibility';
import {ProjectProgressBarComponent} from './project-progress-bar.component';

describe('ProjectProgressBarComponent', () => {
  let component: ProjectProgressBarComponent;
  let fixture: ComponentFixture<ProjectProgressBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectProgressBarComponent],
      imports: [MatProgressBarModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectProgressBarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the project progress name and current percentage', async () => {
    fixture.componentRef.setInput('progress', [
      {value: 0},
      {value: 0},
      {value: 0},
      {value: 0},
      {value: 42},
    ]);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-label')).toBe('Project progress towards target grade');
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    await fixture.whenStable();
    await expectAccessible(fixture.nativeElement);
  });
});
