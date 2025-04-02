import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { AuthenticationService } from '../../api/services/authentication.service';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RuntimeService {
  constructor(private router: Router, private authService: AuthenticationService) {
    this.setupNavigationListener();
  }

  private setupNavigationListener(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      const userRole = this.getUserRole();  // Get role without direct access to userService
      if (!this.authService.isAuthorised([userRole])) {  // Pass as an array
        this.router.navigate(['/unauthorized']);
      }
    });
  }

  // Method to safely get user role through authentication service
  private getUserRole(): string | undefined {
    // Check if the user is authenticated, then access role from currentUser
    if (this.authService.isAuthenticated()) {
      const currentUser = this.authService['userService']?.currentUser;
      return currentUser?.role;
    }
    return undefined;
  }

  handleUnauthorizedAccess(destination: string): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/unauthorized']);
    } else {
      this.router.navigate(['/sign-in'], { queryParams: { dest: destination } });
    }
  }

  handleTokenTimeout(): void {
    this.router.navigate(['/timeout'], { queryParams: { dest: this.router.url } });
  }
}
