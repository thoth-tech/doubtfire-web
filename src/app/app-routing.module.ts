import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SignInComponent } from './sessions/states/sign-in/sign-in.component';
import { ProjectsIndexComponent } from './projects/states/index/index.component';
import { HomeComponent } from './home/states/home/home.component';

const routes: Routes = [
    // Login route
    { path: 'login', component: SignInComponent },

    // Projects Index route
    {
        path: 'projects/:projectId',
        component: ProjectsIndexComponent,
        data: {
            pageTitle: 'Project'
        }
    },

    // Home route
    { path: 'home', component: HomeComponent },

    // Default redirect (empty path)
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Wildcard: catch-all for unknown routes
    { path: '**', redirectTo: 'login' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true })],
    exports: [RouterModule]
})
export class AppRoutingModule { }