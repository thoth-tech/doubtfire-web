import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProjectsIndexStateCtrl } from './projects-index-state.controller';

const routes: Routes = [
    {
        path: 'projects/:projectId',
        component: ProjectsIndexStateCtrl,
        data: {
            pageTitle: '_Home_',
            roleWhitelist: ['Student', 'Tutor', 'Convenor', 'Admin', 'Auditor']
        }
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class ProjectsIndexStateModule { }