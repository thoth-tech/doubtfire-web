import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ProjectCardComponent, ProjectCardData} from './project-card.component';

describe('ProjectCardComponent', () => {
  let component: ProjectCardComponent;
  let fixture: ComponentFixture<ProjectCardComponent>;

  const sampleProject: ProjectCardData = {
    title: 'Cross-Project Dashboard',
    unitCode: 'CPD-F02',
    status: 'In progress',
    progressSummary: 'Reusable dashboard project-card component is being prepared.',
    description: 'This card summarises one project without hardcoding the dashboard data.',
    destinationUrl: '/projects/cpd-f02',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectCardComponent);
    component = fixture.componentInstance;
    component.project = sampleProject;
    fixture.detectChanges();
  });

  it('should create the project card component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the supplied project details', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Cross-Project Dashboard');
    expect(text).toContain('CPD-F02');
    expect(text).toContain('In progress');
    expect(text).toContain('Reusable dashboard project-card component is being prepared.');
  });

  it('should provide an accessible project link', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');

    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/projects/cpd-f02');
    expect(link.getAttribute('aria-label')).toBe('Open Cross-Project Dashboard project details');
  });

  it('should expose the project status to assistive technology', () => {
    const status: HTMLSpanElement = fixture.nativeElement.querySelector('.project-card__status');

    expect(status.textContent.replace(/\s+/g, ' ').trim()).toBe('Project status: In progress');
  });

  it('should handle missing optional fields', () => {
    fixture.componentRef.setInput('project', {
      title: 'Sample Project',
      status: 'Completed',
      progressSummary: 'Core details are still displayed.',
      destinationUrl: '/projects/sample',
    });

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Sample Project');
    expect(text).toContain('Completed');
    expect(text).toContain('Core details are still displayed.');

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('aria-label')).toBe('Open Sample Project project details');
  });
});
