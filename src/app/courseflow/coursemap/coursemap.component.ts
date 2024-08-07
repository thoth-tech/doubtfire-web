import { Component, OnInit } from '@angular/core';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-welcome',
  templateUrl: './coursemap.component.html',
  styleUrls: ['./coursemap.component.scss'],
})
export class CoursemapComponent implements OnInit {
  constructor(private constants: DoubtfireConstants) {}
  ngOnInit(): void {}

  public externalName = this.constants.ExternalName;
}
