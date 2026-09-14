import {describe, expect, it, vi} from 'vitest';
import {EntityFormComponent} from './entity-form.component';

// EntityFormComponent is an abstract base. We exercise submit() on a bare
// instance and stub the collaborators the two feedback branches touch, rather
// than standing a concrete subclass up in a TestBed.
interface BareEntityForm {
  formData: unknown;
  selected: unknown;
  hasChanges: () => boolean;
  entityName: string;
  submit(service: unknown, alertService: unknown, success: unknown): void;
}

describe('EntityFormComponent submit feedback', () => {
  const bare = () => Object.create(EntityFormComponent.prototype) as BareEntityForm;

  it('uses a neutral message, not a red error, when nothing changed', () => {
    const component = bare();
    component.formData = {valid: true};
    component.selected = {id: 1};
    component.hasChanges = () => false;
    component.entityName = 'Tutorial';
    const alertService = {message: vi.fn(), error: vi.fn(), success: vi.fn()};

    component.submit({}, alertService, vi.fn());

    expect(alertService.message).toHaveBeenCalledWith('Tutorial was not changed', 6000);
    expect(alertService.error).not.toHaveBeenCalled();
  });

  it('tells the user the save was blocked when the form is invalid', () => {
    const component = bare();
    const markAllAsTouched = vi.fn();
    component.formData = {valid: false, markAllAsTouched};
    component.entityName = 'Tutorial';
    const alertService = {message: vi.fn(), error: vi.fn(), success: vi.fn()};

    component.submit({}, alertService, vi.fn());

    expect(markAllAsTouched).toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalledWith('Check the highlighted fields', 6000);
  });
});
