import {Routes, UrlMatcher} from '@angular/router';
import {EditProfileComponent} from './account/edit-profile/edit-profile.component';
import {InstitutionSettingsComponent} from './admin/institution-settings/institution-settings.component';
import {FUnitsComponent} from './admin/states/units/units.component';
import {FUsersComponent} from './admin/states/users/users.component';
import {roleWhitelistGuard} from './common/guards/role-whitelist.guard';
import {NotificationsPageComponent} from './common/notifications-page/notifications-page.component';
import {ScormPlayerComponent} from './common/scorm-player/scorm-player.component';
import {SubmissionFilesDownloadComponent} from './common/submission-files-download/submission-files-download.component';
import {SuccessCloseComponent} from './common/success-close/success-close.component';
import {CrossDashboardComponent} from './dashboard/f-cross-dashboard.component';
import {DemoControlsComponent} from './demo/demo-controls/demo-controls.component';
import {demoToolsGuard} from './demo/demo-tools.guard';
import {TimeoutComponent} from './errors/states/timeout/timeout.component';
import {UnauthorisedComponent} from './errors/states/unauthorised/unauthorised.component';
import {AcceptEulaComponent} from './eula/accept-eula/accept-eula.component';
import {HomeComponent} from './home/states/home/home.component';
import {LtiDashboardComponent} from './home/states/lti-dashboard/lti-dashboard.component';
import {LtiUnitLinkComponent} from './home/states/lti-unit-link/lti-unit-link.component';
import {resolveProject} from './projects/project.resolver';
import {ProjectDashboardComponent} from './projects/states/dashboard/project-dashboard/project-dashboard.component';
import {ProjectGroupsStateComponent} from './projects/states/groups/project-groups-state.component';
import {JplagReportViewerComponent} from './projects/states/jplag/jplag-report-viewer.component';
import {ProjectPlanComponent} from './projects/states/plan/project-plan.component';
import {PortfolioStateComponent} from './projects/states/portfolio/portfolio-state.component';
import {ProjectRootStateComponent} from './projects/states/project-root-state.component';
import {TutorDiscussionComponent} from './projects/states/tutor-discussion/tutor-discussion.component';
import {TutorialsComponent} from './projects/states/tutorials/tutorials.component';
import {SignInComponent} from './sessions/states/sign-in/sign-in.component';
import {UnitAnalyticsComponent} from './units/states/analytics/unit-analytics-route.component';
import {UnitAdminStateComponent} from './units/states/edit/unit-admin-state.component';
import {UnitGroupsComponent} from './units/states/groups/unit-groups/unit-groups.component';
import {PortfoliosComponent} from './units/states/portfolios/portfolios.component';
import {RolloverComponent} from './units/states/rollover/rollover.component';
import {StudentsListComponent} from './units/states/students-list/students-list.component';
import {UnitTaskInboxStateComponent} from './units/states/tasks/inbox/unit-task-inbox-state.component';
import {TaskViewerStateComponent} from './units/task-viewer/task-viewer-state.component';
import {UnitRootStateComponent} from './units/unit-root-state.component';
import {resolveUnit} from './units/unit.resolver';
import {WelcomeComponent} from './welcome/welcome.component';

export const projectDashboardTaskMatcher: UrlMatcher = (segments) => {
  if (segments.length < 2 || segments.length > 3 || segments[0].path !== 'dashboard') {
    return null;
  }

  if (segments.length === 3 && segments[2].path !== 'feedback') {
    return null;
  }

  return {
    consumed: segments,
    posParams: {
      taskAbbreviation: segments[1],
      ...(segments[2] ? {mobilePane: segments[2]} : {}),
    },
  };
};

export const routes: Routes = [
  {path: '', pathMatch: 'full', redirectTo: 'home'},
  {path: 'home', component: HomeComponent},
  {path: 'sign_in', component: SignInComponent},
  {path: 'welcome', component: WelcomeComponent},
  {path: 'unauthorised', component: UnauthorisedComponent},
  {path: 'timeout', component: TimeoutComponent},
  {path: 'success-close', component: SuccessCloseComponent},
  {path: 'edit_profile', component: EditProfileComponent},
  {path: 'notifications', component: NotificationsPageComponent},
  {
    path: 'demo-controls',
    component: DemoControlsComponent,
    canActivate: [demoToolsGuard],
    data: {pageTitle: 'Demo controls'},
  },
  {path: 'eula', component: AcceptEulaComponent},
  {path: 'lti', component: LtiDashboardComponent},
  {path: 'lti/link', component: LtiUnitLinkComponent},
  // Deliberately open: this is an empty iframe onto the bundled JPlag viewer at /JPlag/. It
  // makes no api call and shows nothing until staff hand it a blob url that only exists in
  // their own tab, so there is nothing here to guard. Listed in DELIBERATELY_OPEN_PATHS.
  {path: 'jplag-report-viewer', component: JplagReportViewerComponent},
  {
    path: 'projects/:projectId/task_def_id/:taskDefId/scorm-player/normal',
    component: ScormPlayerComponent,
    data: {mode: 'normal'},
  },
  {
    path: 'projects/:projectId/task_def_id/:taskDefId/scorm-player/review/:testAttemptId',
    component: ScormPlayerComponent,
    data: {mode: 'review'},
  },
  {
    path: 'task_def_id/:taskDefId/preview-scorm',
    component: ScormPlayerComponent,
    data: {mode: 'preview'},
  },
  {
    path: 'projects/:projectId/task_def_id/:taskDefId/submission_files/download',
    component: SubmissionFilesDownloadComponent,
  },
  {
    path: 'view-all-units',
    component: FUnitsComponent,
    canActivate: [roleWhitelistGuard],
    data: {mode: 'tutor', roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor']},
  },
  // Deliberately open: 'student' mode lists the signed in user's own enrolled units.
  {path: 'view-all-projects', component: FUnitsComponent, data: {mode: 'student'}},
  {
    path: 'dashboard',
    component: CrossDashboardComponent,
    canActivate: [roleWhitelistGuard],
    data: {roleWhitelist: ['Student'], pageTitle: 'Dashboard'},
  },
  {
    path: 'admin/units',
    component: FUnitsComponent,
    canActivate: [roleWhitelistGuard],
    data: {mode: 'admin', roleWhitelist: ['Admin', 'Auditor', 'Convenor']},
  },
  {
    path: 'admin/users',
    component: FUsersComponent,
    canActivate: [roleWhitelistGuard],
    data: {roleWhitelist: ['Admin', 'Auditor']},
  },
  {
    path: 'admin/institution-settings',
    component: InstitutionSettingsComponent,
    canActivate: [roleWhitelistGuard],
    data: {roleWhitelist: ['Admin', 'Auditor']},
  },
  {
    path: 'admin/institution-settings/:tab',
    component: InstitutionSettingsComponent,
    canActivate: [roleWhitelistGuard],
    data: {roleWhitelist: ['Admin', 'Auditor']},
  },
  {
    path: 'tutor-discussion',
    component: TutorDiscussionComponent,
    canActivate: [roleWhitelistGuard],
    data: {task: 'Discussion', roleWhitelist: ['Admin', 'Auditor', 'Tutor']},
  },
  // Top level, so the guard checks the SYSTEM role here, not a unit role. Convenor is in the
  // list because this url is open to system convenors today and guarding it must not take that
  // away. It is a wider list than 'tutor-discussion' above, which this change does not touch.
  {
    path: 'tutor-attendance',
    component: TutorDiscussionComponent,
    canActivate: [roleWhitelistGuard],
    data: {
      attendance: true,
      task: 'Check-in',
      roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
    },
  },
  {
    path: 'units',
    children: [
      {path: '', pathMatch: 'full', redirectTo: '/home'},
      {
        path: ':unitId',
        component: UnitRootStateComponent,
        resolve: {
          unit: resolveUnit,
        },
        children: [
          {path: '', pathMatch: 'full', redirectTo: 'tasks/inbox'},
          {
            path: 'analytics',
            component: UnitAnalyticsComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Unit Analytics',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students/groups',
            component: UnitGroupsComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Student Groups',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students/portfolios',
            component: PortfoliosComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Student Portfolios',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students/portfolios/:projectId',
            component: PortfoliosComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Student Portfolios',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students/portfolios/:projectId/:tab',
            component: PortfoliosComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Student Portfolios',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students/portfolios/:projectId/:tab/:taskAbbreviation',
            component: PortfoliosComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              task: 'Student Portfolios',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'students',
            component: StudentsListComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Student List', roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor']},
          },
          {
            path: 'admin',
            component: UnitAdminStateComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Unit Administration', roleWhitelist: ['Convenor', 'Admin', 'Auditor']},
          },
          {
            path: 'admin/:tab',
            component: UnitAdminStateComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Unit Administration', roleWhitelist: ['Convenor', 'Admin', 'Auditor']},
          },
          {
            path: 'rollover',
            component: RolloverComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Unit Rollover', roleWhitelist: ['Convenor', 'Admin', 'Auditor']},
          },
          // Convenor is in both lists because the staff menu offers Discussion and Check-in to
          // every unit role, and the header QR button routes non students straight to
          // 'discussion'. Do not narrow these to the 'tutor-discussion' list at the top level:
          // that one is matched against the system role, this one against the unit role.
          {
            path: 'discussion',
            component: TutorDiscussionComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Discussion', roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor']},
          },
          {
            path: 'check-in',
            component: TutorDiscussionComponent,
            canActivate: [roleWhitelistGuard],
            data: {
              attendance: true,
              task: 'Check-in',
              roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor'],
            },
          },
          {
            path: 'tasks',
            pathMatch: 'full',
            component: TaskViewerStateComponent,
            data: {task: 'Task Lists', roleWhitelist: ['Convenor', 'Admin', 'Auditor']},
            canActivate: [roleWhitelistGuard],
          },
          {
            // The guard on this parent runs for every inbox child below it.
            path: 'tasks',
            canActivate: [roleWhitelistGuard],
            data: {roleWhitelist: ['Convenor', 'Admin', 'Auditor', 'Tutor']},

            children: [
              {path: '', pathMatch: 'full', redirectTo: 'inbox'},
              {
                path: 'inbox',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'inbox', task: 'Task Inbox'},
              },
              {
                path: 'inbox/:studentId/:taskDefAbbr',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'inbox', task: 'Task Inbox'},
              },
              {
                path: 'definition',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'definition', task: 'Task Explorer'},
              },
              {
                path: 'definition/:studentId/:taskDefAbbr',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'definition', task: 'Task Explorer'},
              },
              {
                path: 'moderation',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'moderation', task: 'Task Moderation'},
              },
              {
                path: 'moderation/:studentId/:taskDefAbbr',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'moderation', task: 'Task Moderation'},
              },
              {
                path: 'overflow',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'overflow', task: 'Task Overflow'},
              },
              {
                path: 'overflow/:studentId/:taskDefAbbr',
                component: UnitTaskInboxStateComponent,
                data: {routeMode: 'overflow', task: 'Task Overflow'},
              },
            ],
          },
          // Deliberately the same list as the 'tasks' viewer above, which is narrower than the
          // inbox children. This is the whole unit task list, not one tutor's queue. A deep link
          // meant for a tutor belongs on 'tasks/inbox/:studentId/:taskDefAbbr', which does
          // whitelist Tutor.
          {
            path: 'tasks/:taskAbbreviation',
            component: TaskViewerStateComponent,
            canActivate: [roleWhitelistGuard],
            data: {task: 'Task Lists', roleWhitelist: ['Convenor', 'Admin', 'Auditor']},
          },
        ],
      },
    ],
  },
  {
    path: 'projects',
    children: [
      {path: '', pathMatch: 'full', redirectTo: '/home'},
      {
        path: ':projectId',
        component: ProjectRootStateComponent,
        resolve: {
          project: resolveProject,
        },
        children: [
          {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
          {
            path: 'dashboard',
            component: ProjectDashboardComponent,
            data: {task: 'Dashboard'},
          },
          {
            matcher: projectDashboardTaskMatcher,
            component: ProjectDashboardComponent,
            data: {task: 'Dashboard'},
          },
          {path: 'plan', component: ProjectPlanComponent, data: {task: 'Plan Tasks'}},
          {
            path: 'portfolio',
            component: PortfolioStateComponent,
            data: {task: 'Portfolio Creation'},
          },
          {path: 'groups', component: ProjectGroupsStateComponent, data: {task: 'Groups List'}},
          {path: 'tutorials', component: TutorialsComponent, data: {task: 'Tutorial List'}},
        ],
      },
    ],
  },
  {path: '**', redirectTo: 'home'},
];
