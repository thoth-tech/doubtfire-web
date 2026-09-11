import {CommonModule} from '@angular/common';
import {HTTP_INTERCEPTORS} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {RouterModule} from '@angular/router';
import {DemoControlsComponent} from './demo-controls/demo-controls.component';
import {DemoDataMaskInterceptor} from './demo-data-mask.interceptor';
import {DemoModeBannerComponent} from './demo-mode-banner/demo-mode-banner.component';

@NgModule({
  declarations: [DemoControlsComponent, DemoModeBannerComponent],
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  exports: [DemoModeBannerComponent],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DemoDataMaskInterceptor,
      multi: true,
    },
  ],
})
export class DemoToolsModule {}
