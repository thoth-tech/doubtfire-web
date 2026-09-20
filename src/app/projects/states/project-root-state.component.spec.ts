import {describe, expect, it} from 'vitest';
import {ActivatedRoute, Data} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {Project} from 'src/app/api/models/doubtfire-model';
import {ProjectRootStateComponent} from './project-root-state.component';

describe('ProjectRootStateComponent', () => {
  it('passes project resolver updates to a reused child route', () => {
    const firstProject = {id: 2} as Project;
    const secondProject = {id: 18} as Project;
    const routeData: BehaviorSubject<Data> = new BehaviorSubject({project: firstProject});
    const component = new ProjectRootStateComponent({
      data: routeData.asObservable(),
    } as ActivatedRoute);
    const child: {project$?: typeof component.project$} = {project$: undefined};
    const projectIds: number[] = [];

    component.onActivate(child);
    child.project$.subscribe((project) => projectIds.push(project.id));
    routeData.next({project: secondProject});

    expect(projectIds).toEqual([2, 18]);
  });
});
