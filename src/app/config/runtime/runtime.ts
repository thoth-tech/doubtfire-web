import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { AuthenticationService } from 'src/app/api/services/authentication.service';
import { UserService } from 'src/app/api/services/user.service';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
// When OnTrack starts it runs the service and enforces route-level auth.
export class RuntimeService {
  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private userService: UserService
  ) {
    // Setting up a navigation guard when the service is instantiated
    this.setupNavigationGuard();
  }

  // Setting up a listener for route nav, checks users role and auth, will redirect to login if unauthorised
  private setupNavigationGuard(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      // Gets the users role
      const userRole = this.getCurrentUserRole();
      // Defines the role
      const requiredRoles = [userRole];

      // Pushes user to login if not authorised
      if (!this.authService.isAuthorised(requiredRoles) && this.router.url !== '/login') {
        this.router.navigate(['/login']);
      }
    });
  }

  // Gets the user current from and falls back to guest if not currently logged in
  private getCurrentUserRole(): string {
    return this.userService.currentUser?.role ?? 'guest';
  }
}
