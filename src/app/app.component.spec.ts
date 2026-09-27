// MN-C03 and MN-C05 targeted startup and teardown test.
import {describe, expect, it, vi} from 'vitest';
import {Renderer2} from '@angular/core';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {PushNotificationClickService} from 'src/app/api/services/push-notification-click.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {AppComponent} from './app.component';
import {ThemeService} from './common/theme/theme.service';

describe('AppComponent push lifecycle', () => {
  it('starts push listeners at app startup and stops them at teardown', () => {
    const events: Subject<unknown> = new Subject();
    const router = {
      url: '/home',
      events: events.asObservable(),
    } as unknown as Router;
    const renderer = {
      setStyle: vi.fn(),
    } as unknown as Renderer2;
    const clickRouting = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as PushNotificationClickService;
    const pushNotifications = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as PushNotificationService;
    const appLifecycle = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as AppLifecycleService;

    const theme = {} as unknown as ThemeService;

    const component = new AppComponent(
      router,
      renderer,
      clickRouting,
      pushNotifications,
      theme,
      appLifecycle,
    );
    component.ngOnInit();

    expect(appLifecycle.start).toHaveBeenCalledOnce();
    expect(clickRouting.start).toHaveBeenCalledOnce();
    expect(pushNotifications.start).toHaveBeenCalledOnce();

    component.ngOnDestroy();

    expect(appLifecycle.stop).toHaveBeenCalledOnce();
    expect(clickRouting.stop).toHaveBeenCalledOnce();
    expect(pushNotifications.stop).toHaveBeenCalledOnce();
  });
});
