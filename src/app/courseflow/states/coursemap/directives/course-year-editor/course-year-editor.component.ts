import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CourseYear, TRIMESTER_KEYS} from '../../../../models/course-map.models';
import {CourseMapStateService} from '../../../../services/course-map-state.service';
import {TrimesterEditorComponent} from '../trimester-editor/trimester-editor.component';

@Component({
  selector: 'course-year-editor',
  templateUrl: './course-year-editor.component.html',
  styleUrls: ['./course-year-editor.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, TrimesterEditorComponent],
})
export class CourseYearEditorComponent {
  @Input() year!: CourseYear;
  @Input() yearIndex!: number;
  @Input() stateService!: CourseMapStateService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() dropEvent = new EventEmitter<any>();

  readonly trimesterKeys = TRIMESTER_KEYS;

  deleteYear(): void {
    this.stateService.deleteYear(this.yearIndex);
  }

  addTrimester(): void {
    this.stateService.addTrimester(this.yearIndex);
  }

  deleteTrimester(trimesterIndex: number): void {
    this.stateService.deleteTrimester(this.yearIndex, trimesterIndex);
  }

  countTrimesters(): number {
    return this.stateService.countTrimesters(this.year);
  }

  getTrimesterNumber(key: string): number {
    return this.stateService.getTrimesterNumber(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTrimesterDrop(event: any): void {
    this.dropEvent.emit(event);
  }
}
