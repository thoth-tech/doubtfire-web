import {beforeEach, describe, expect, it, vi} from 'vitest';
import {of, throwError} from 'rxjs';
import {FUsersComponent} from './users.component';

describe('FUsersComponent CSV import result', () => {
  let component: FUsersComponent;

  let userService: {
    fetchAll: ReturnType<typeof vi.fn>;
  };

  let alerts: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userService = {
      fetchAll: vi.fn(() => of([])),
    };

    alerts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    component = new FUsersComponent(
      userService as unknown as ConstructorParameters<typeof FUsersComponent>[0],
      {} as ConstructorParameters<typeof FUsersComponent>[1],
      {} as ConstructorParameters<typeof FUsersComponent>[2],
      {} as ConstructorParameters<typeof FUsersComponent>[3],
      alerts as unknown as ConstructorParameters<typeof FUsersComponent>[4],
    );
  });

  it('shows a success alert and refreshes the table when the CSV import has no errors', () => {
    component['onUserUploadSuccess']({
      body: {
        errors: [],
        success: Array(50).fill({}),
        ignored: [],
      },
    });

    expect(alerts.success).toHaveBeenCalledWith(
      '50 users successfully updated, 0 users ignored, 0 users contained an error in the CSV...',
    );
    expect(alerts.error).not.toHaveBeenCalled();
    expect(userService.fetchAll).toHaveBeenCalledOnce();
  });

  it('shows an error alert when the CSV import contains errors', () => {
    component['onUserUploadSuccess']({
      body: {
        errors: [{message: 'Invalid user'}],
        success: [],
        ignored: [],
      },
    });

    expect(alerts.error).toHaveBeenCalledWith(
      '0 users successfully updated, 0 users ignored, 1 users contained an error in the CSV...Invalid user\n',
    );
    expect(alerts.success).not.toHaveBeenCalled();
    expect(userService.fetchAll).toHaveBeenCalledOnce();
  });

  it('surfaces an error alert when the refresh request fails', () => {
    userService.fetchAll = vi.fn(() => throwError(() => 'refresh failed'));

    component['onUserUploadSuccess']({
      body: {
        errors: [],
        success: Array(1).fill({}),
        ignored: [],
      },
    });

    expect(alerts.error).toHaveBeenCalledWith('refresh failed');
  });
});
