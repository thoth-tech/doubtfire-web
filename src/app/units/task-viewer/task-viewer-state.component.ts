/* eslint-disable @typescript-eslint/no-explicit-any */
import {CdkDragEnd, CdkDragMove, CdkDragStart} from '@angular/cdk/drag-drop';
import {Component, Input, OnInit} from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  auditTime,
  first,
  merge,
  of,
  tap,
  withLatestFrom,
} from 'rxjs';
import {TaskDefinition, Unit, UnitService, UserService} from 'src/app/api/models/doubtfire-model';
import { AppInjector } from '../../app-injector';
import { NgHybridStateDeclaration } from '@uirouter/angular-hybrid';
import { GlobalStateService, ViewType } from '../../projects/states/index/global-state.service';
import { StateService } from '@uirouter/core';
import { AlertService } from '../../common/services/alert.service';

@Component({
  selector: 'f-task-viewer-state',
  templateUrl: './task-viewer-state.component.html',
  styleUrl: './task-viewer-state.component.scss',
})
export class TaskViewerStateComponent {
  @Input() public unit$: Observable<Unit>;
}

export const TaskViewerState: NgHybridStateDeclaration = {
  name: 'units2/tasks',
  url: '/tasks/:taskDefId',
  parent: 'unit-root-state',
  data: {
    pageTitle: 'Unit Tasks',
    roleWhiteList: ['Tutor', 'Convenor', 'Admin', 'Auditor'],
  },
  views: {
    unitView: {
      component: TaskViewerStateComponent,
    },
  },
};
