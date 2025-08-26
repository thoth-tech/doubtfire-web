import { Injectable } from '@angular/core';

import { AlertService } from "src/app/common/services/alert.service";
import { UnitService } from "src/app/api/services/unit.service";
import { UserService } from "src/app/api/services/user.service";
import { GlobalStateService } from "src/app/projects/states/index/global-state.service";

interface ITab {
  title: string;
  seq: number;
  active?: boolean;
  deselect?: () => void;
}

interface ITabs {
  unitTab: ITab;
  learningOutcomesTab: ITab;
  staffTab: ITab;
  tutorialsTab: ITab;
  studentsTab: ITab;
  tasksTab: ITab;
  taskAlignmentTab: ITab;
  groupsTab: ITab;
}

interface IEditUnitScope {
  currentStaff: any[];
  assessingUnitRole: any;
  staff: any[];
  unit: any;
  tabs: ITabs;
  activeTab: ITab;
  setActiveTab: (tab: ITab) => void;
}

@Injectable({
  providedIn: 'root',
})
export class EditUnitStateService {
  constructor(
    private alertService: AlertService,
    private unitService: UnitService,
    private userService: UserService,
    private globalStateService: GlobalStateService,
  ) {}

  public initializeEdit(scope: IEditUnitScope): void {
    this.globalStateService.onLoad(() => {
      scope.currentStaff = scope.unit.staff || [];

      scope.assessingUnitRole = this.globalStateService.loadedUnitRoles?.currentValues
        ?.find((role: any) => role.unit === scope.unit);

      this.userService.getTutors().subscribe((tutors: any[]) => {
        scope.staff = tutors || [];
      });
    });
  }

  public setupTabs(): ITabs {
    return {
      unitTab: {
        title: "Unit Details",
        seq: 0
      },
      learningOutcomesTab: {
        title: "Learning Outcomes",
        seq: 1
      },
      staffTab: {
        title: "Staff",
        seq: 2
      },
      tutorialsTab: {
        title: "Tutorials",
        seq: 3
      },
      studentsTab: {
        title: "Students",
        seq: 4
      },
      tasksTab: {
        title: "Tasks",
        seq: 5
      },
      taskAlignmentTab: {
        title: "Task Alignment",
        seq: 5
      },
      groupsTab: {
        title: "Groups",
        seq: 6
      }
    };
  }

  public setActiveTab(scope: IEditUnitScope, tab: ITab): void {
    if (tab === scope.activeTab) return;

    if (scope.activeTab) {
      scope.activeTab.active = false;

      if (scope.activeTab.deselect) {
        scope.activeTab.deselect();
      }
    }

    scope.activeTab = tab;
    scope.activeTab.active = true;
  }
}

