import { Component, OnInit } from '@angular/core';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-courseflow',
  templateUrl: './courseflow.component.html',
  styleUrls: ['./courseflow.component.scss'],
})
export class CourseFlowComponent implements OnInit {
  public someProperty: string;

  constructor(private constants: DoubtfireConstants) {}

  ngOnInit(): void {
    this.someProperty = this.constants.SomeConstant;
  }
}
