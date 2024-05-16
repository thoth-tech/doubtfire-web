import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-task-ilo-alignment-rater',
  templateUrl: './task-ilo-alignment-rater.component.html',
  styleUrls: ['./task-ilo-alignment-rater.component.css']
})
export class TaskIloAlignmentRaterComponent {
  @Input() readonly: boolean = false;
  @Input() ngModel: any; // Change the type to match your ngModel structure
  @Input() unit: any; // Change the type to match your unit structure
  @Input() onRatingChanged?: Function;
  @Input() tooltips: boolean = true;
  @Input() colorful: boolean = true;
  @Input() selectedTooltip: boolean = true;
  @Input() showTooltips: boolean = false;
  @Input() hideLabels: boolean = false;
  @Input() compact: boolean = false;
  @Input() label: boolean = false;
  @Input() showZeroRating: boolean = false;

  max: number = 5;
  hoveringOver: any;

  constructor(private outcomeService: OutcomeService) {}

  setHoverValue(value: any) {
    if (this.readonly && !this.showTooltips) return this.ngModel;
    this.hoveringOver = value;
    this.label = this.tooltips[value];
  }

  ngOnInit() {
    this.tooltips = this.outcomeService.alignmentLabels;

    this.hideLabels = this.hideLabels || false;
    this.showZeroRating = this.showZeroRating || false;
    this.readonly = this.compact ? true : false;

    for (const property of ['tooltips', 'colorful', 'selectedTooltip']) {
      this[property] = this[property] !== undefined ? this[property] : true;
    }

    this.showTooltips = this.showTooltips !== undefined ? this.showTooltips : false;
  }

  ngOnChanges() {
    if (this.onRatingChanged) {
      this.ngModel.rating = this.ngModel.rating || 0;
    }
  }

  onRatingChange() {
    if (this.onRatingChanged) {
      this.onRatingChanged(this.ngModel);
    }
  }
}
