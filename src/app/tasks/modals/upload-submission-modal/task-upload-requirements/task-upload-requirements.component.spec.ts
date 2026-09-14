import {ComponentFixture, TestBed} from '@angular/core/testing';
import {UploadRequirement} from 'src/app/api/models/task-definition';
import {TaskUploadRequirementsComponent} from './task-upload-requirements.component';

describe('TaskUploadRequirementsComponent', () => {
  let component: TaskUploadRequirementsComponent;
  let fixture: ComponentFixture<TaskUploadRequirementsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskUploadRequirementsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskUploadRequirementsComponent);
    component = fixture.componentInstance;
  });

  function setRequirements(requirements: UploadRequirement[] | null | undefined) {
    component.requirements = requirements;
    component.ngOnChanges({
      requirements: {
        currentValue: requirements,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    fixture.detectChanges();
  }

  it('should create', () => {
    setRequirements([]);
    expect(component).toBeTruthy();
  });

  describe('normal state', () => {
    it('shows the category, accepted formats and required file count for each requirement', () => {
      setRequirements([
        {key: 'file0', name: 'Report', type: 'document'},
        {key: 'file1', name: 'Data', type: 'csv'},
      ]);

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Files required:');
      expect(text).toContain('2');
      expect(text).toContain('Document');
      expect(text).toContain('PDF');
      expect(text).toContain('Spreadsheet');
      expect(text).toContain('CSV');
      expect(text).toContain('XLS');
      expect(text).toContain('XLSX');
    });

    it('does not show an expand control when the extension list is short', () => {
      setRequirements([{key: 'file0', name: 'Report', type: 'document'}]);

      const toggle = fixture.nativeElement.querySelector('.extensions-toggle');
      expect(toggle).toBeNull();
    });
  });

  describe('long extension list state', () => {
    it('truncates a long extension list behind a collapsed, keyboard-operable toggle', () => {
      setRequirements([{key: 'file0', name: 'Source code', type: 'code'}]);

      const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.extensions-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      const list: HTMLUListElement = fixture.nativeElement.querySelector('.extensions-list');
      expect(list.hidden).toBe(true);

      toggle.click();
      fixture.detectChanges();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(list.hidden).toBe(false);
      expect(list.textContent).toContain('JSON');
      expect(list.textContent).toContain('IPYNB');
    });
  });

  describe('missing policy state', () => {
    it('shows a safe message when there are no upload requirements', () => {
      setRequirements([]);

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('not currently available');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
    });

    it('shows a safe message when upload requirements are null', () => {
      setRequirements(null);

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('not currently available');
    });

    it('does not invent a size limit when the API does not expose one', () => {
      setRequirements([{key: 'file0', name: 'Report', type: 'document'}]);

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Maximum size:');
      expect(text).toContain('Not provided by the server');
    });
  });

  it('uses current uploader extensions including Vue and compressed tar aliases', () => {
    setRequirements([
      {key: 'file0', name: 'Source', type: 'code'},
      {key: 'file1', name: 'Archive', type: 'archive'},
    ]);
    expect(component.summaries[0].extensions).toContain('VUE');
    expect(component.summaries[1].categoryLabel).toBe('Archive');
    expect(component.summaries[1].extensions).toContain('TGZ');
  });

  it('uses unique description ids when two instances are rendered', () => {
    const second = TestBed.createComponent(TaskUploadRequirementsComponent);
    expect(second.componentInstance.elementId).not.toBe(component.elementId);
    second.destroy();
  });

  it('clears expanded state when the requirements change', () => {
    setRequirements([{key: 'file0', name: 'Source', type: 'code'}]);
    component.toggleExpanded(component.summaries[0]);
    setRequirements([{key: 'file0', name: 'New source', type: 'code'}]);
    expect(component.isExpanded(component.summaries[0])).toBe(false);
  });

  describe('invalid/unrecognised requirement type state', () => {
    it('falls back to a safe label instead of crashing or showing undefined', () => {
      setRequirements([{key: 'file0', name: 'Mystery file', type: 'not-a-real-type'}]);

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('not-a-real-type');
      expect(text).toContain('Not specified for this task');
      expect(text).not.toContain('undefined');
    });
  });
});
