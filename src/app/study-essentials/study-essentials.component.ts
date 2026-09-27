import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {STUDY_ESSENTIALS_PROFILE, studyEssentialsFor} from './study-essentials.config';

@Component({
  selector: 'f-study-essentials',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './study-essentials.component.html',
  styleUrl: './study-essentials.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyEssentialsComponent {
  readonly links = studyEssentialsFor(inject(STUDY_ESSENTIALS_PROFILE));
  // one scrollable row of links, for pages where the tiles would push content down
  readonly compact = input(false);
}
