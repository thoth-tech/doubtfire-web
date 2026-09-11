import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {DEMO_RELOAD} from '../demo-controls/demo-controls.component';
import {DemoModeStore} from '../demo-mode.store';
import {DemoToolsModule} from '../demo-tools.module';
import {DemoModeBannerComponent} from './demo-mode-banner.component';

describe('DemoModeBannerComponent', () => {
  let fixture: ComponentFixture<DemoModeBannerComponent>;
  let enabled: BehaviorSubject<boolean>;
  let reset: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    enabled = new BehaviorSubject(true);
    reset = vi.fn(() => enabled.next(false));
    reload = vi.fn();

    await TestBed.configureTestingModule({
      imports: [DemoToolsModule, NoopAnimationsModule],
      providers: [
        {provide: DemoModeStore, useValue: {enabled$: enabled.asObservable(), reset}},
        {provide: DEMO_RELOAD, useValue: reload},
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DemoModeBannerComponent);
    fixture.detectChanges();
  });

  it('stays visible across routes while demo mode is active', () => {
    expect(fixture.nativeElement.textContent).toContain('Demo mode:');
    expect(fixture.nativeElement.textContent).toContain('Exit demo');
  });

  it('exits demo mode and reloads the application', () => {
    fixture.componentInstance.exitDemo();

    expect(reset).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});
