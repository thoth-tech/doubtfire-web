import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, Renderer2} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {Subscription, filter} from 'rxjs';
import {PushNotificationClickService} from 'src/app/api/services/push-notification-click.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {ThemeService} from './common/theme/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  constructor(
    private router: Router,
    private renderer: Renderer2,
    private pushNotificationClicks: PushNotificationClickService,
    private pushNotifications: PushNotificationService,
    // Injected only so the root always constructs it: its constructor stamps the
    // resolved theme onto <html>. Without this the marker is only applied when the
    // header toggle renders, so it never runs on xs where the toggle is hidden.
    private theme: ThemeService,
  ) {}

  ngOnInit(): void {
    this.pushNotificationClicks.start();
    this.pushNotifications.start();
    this.setBodyBackground(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => this.setBodyBackground(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.pushNotificationClicks.stop();
    this.pushNotifications.stop();
    this.routerSub?.unsubscribe();
  }

  private setBodyBackground(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    // THM-M01: was hardcoded #f5f5f5 / #fff set inline, which beats any stylesheet
    // and never flipped in dark. Onto the tokens (with a legacy fallback) so they
    // follow the resolved-theme marker.
    const background =
      path === '/home' || path === '/'
        ? 'var(--ot-color-page, #f5f5f5)'
        : 'var(--ot-color-surface, #fff)';
    this.renderer.setStyle(document.body, 'background-color', background);
  }
}
