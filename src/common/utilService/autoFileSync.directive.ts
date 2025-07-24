import {Directive, ElementRef, Input, NgZone, OnInit} from '@angular/core';
import {NgModel} from '@angular/forms';

@Directive({
  selector: '[fAutoFillSync]',
  standalone: true,
})
export class AutoFillSyncDirective implements OnInit {
  @Input() ngModel: NgModel;

  constructor(
    private el: ElementRef,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    const elem = this.el.nativeElement;
    const origVal = elem.value;
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        const newVal = elem.value;
        if (this.ngModel && this.ngModel.pristine && origVal !== newVal) {
          this.ngModel.control.setValue(newVal);
        }
      }, 500);
    });
  }
}
