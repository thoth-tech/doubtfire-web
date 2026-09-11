import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, Renderer2} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {Subscription, filter} from 'rxjs';
import {PushNotificationClickService} from 'src/app/api/services/push-notification-click.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';

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
    const background = path === '/home' || path === '/' ? '#f5f5f5' : '#fff';
    this.renderer.setStyle(document.body, 'background-color', background);
  }
}
