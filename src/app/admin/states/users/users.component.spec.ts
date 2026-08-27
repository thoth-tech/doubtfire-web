import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FUsersComponent} from './users.component';

describe('FUsersComponent CSV import result', () => {
  let component: FUsersComponent;

  let userService: {
    query: ReturnType<typeof vi.fn>;
  };

  let alerts: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userService = {
      query: vi.fn(),
    };

    alerts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    component = new FUsersComponent(
      userService as any,
      {} as any,
      {} as any,
      {} as any,
      alerts as any,
    );
  });

  it('shows a success alert when the CSV import has no errors', () => {
    (component as any).onUserUploadSuccess({
      body: {
        errors: [],
        success: Array(50).fill({}),
        ignored: [],
      },
    });

    expect(alerts.success).toHaveBeenCalledOnce();
    expect(alerts.error).not.toHaveBeenCalled();
    expect(userService.query).toHaveBeenCalledOnce();
  });

  it('shows an error alert when the CSV import contains errors', () => {
    (component as any).onUserUploadSuccess({
      body: {
        errors: [{message: 'Invalid user'}],
        success: [],
        ignored: [],
      },
    });

    expect(alerts.error).toHaveBeenCalledOnce();
    expect(alerts.success).not.toHaveBeenCalled();
    expect(userService.query).toHaveBeenCalledOnce();
  });
});
