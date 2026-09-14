import {beforeEach, describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {UnitStaffEditorComponent} from './unit-staff-editor.component';

// STAFF-05: the mentor dropdown must clear a mentor to null, not the empty
// string, so PUT /unit_roles/:id actually resets the numeric mentor_id.
describe('UnitStaffEditorComponent selectMentor', () => {
  let component: UnitStaffEditorComponent;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    update = vi.fn(() => of({}));
    const unitRoleService = {update} as never;
    const alertService = {success: vi.fn(), error: vi.fn()} as never;
    component = new UnitStaffEditorComponent(
      alertService,
      unitRoleService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('clears the mentor to null when (None) is chosen', () => {
    const unitRole = {mentorId: 7, role: 'Tutor', roleId: 2};

    component.selectMentor(unitRole as never, {value: null} as never);

    expect(unitRole.mentorId).toBeNull();
    expect(update).toHaveBeenCalledOnce();
  });

  it('sets the mentor id when a staff member is chosen', () => {
    const unitRole = {mentorId: null, role: 'Tutor', roleId: 2};

    component.selectMentor(unitRole as never, {value: 5} as never);

    expect(unitRole.mentorId).toBe(5);
  });
});
