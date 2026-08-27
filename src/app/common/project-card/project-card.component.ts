import {Component, Input} from '@angular/core';

export interface ProjectCardData {
  title: string;
  status: string;
  progressSummary: string;
  destinationUrl: string;
  unitCode?: string;
  description?: string;
}

@Component({
  selector: 'project-card',
  standalone: false,
  templateUrl: './project-card.component.html',
  styleUrls: ['./project-card.component.scss'],
})
export class ProjectCardComponent {
  @Input() project!: ProjectCardData;
}
