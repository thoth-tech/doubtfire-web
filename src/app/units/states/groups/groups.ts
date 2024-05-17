import { NgModule, Component, OnInit } from '@angular/core';
import { RouterModule, Routes, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class UnitService {
  constructor() {}

  hasGroupwork(): boolean {
    return true;
  }
}
@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(private unitService: UnitService) {}

  canActivate(): boolean {
    return true;
  }
}

// Component definition
@Component({
  selector: 'app-unit-groups-state',
  templateUrl: './groups.html',
})
export class UnitGroupsStateComponent implements OnInit {
  constructor(private unitService: UnitService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (!this.unitService.hasGroupwork()) {
      // Handle the case where there is no groupwork
      console.log("No groupwork available");
      return;
    }
    // Additional logic if needed
  }
}

// Routing configuration
const routes: Routes = [
  {
    path: 'units/students/groups',
    component: UnitGroupsStateComponent,
    data: {
      task: "Student Groups",
      pageTitle: "_Home_",
      roleWhitelist: ['Tutor', 'Convenor', 'Admin']
    },
    canActivate: [AuthGuard] // Add guards if needed
  }
];

// Module definition
@NgModule({
  declarations: [UnitGroupsStateComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  providers: [UnitService, AuthGuard] // Register services and guards
})
export class GroupsModule {}
