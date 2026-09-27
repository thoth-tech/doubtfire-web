import {Injectable} from '@angular/core';
import {UserService} from 'src/app/api/services/user.service';
import type {PortfolioListFilters} from './directives/portfolios-list/portfolios-list.component';

export interface PortfolioListView {
  sortActive: string;
  sortDirection: 'asc' | 'desc';
  pageIndex: number;
  pageSize: number;
}

export const DEFAULT_PORTFOLIO_LIST_VIEW: PortfolioListView = {
  sortActive: 'name',
  sortDirection: 'asc',
  pageIndex: 0,
  pageSize: 25,
};

// The student list, a student and a task on the portfolios page are separate routes, so
// the router builds the page again each time the tutor moves between them. What the
// tutor set up while marking lives here instead, so it is still there when they come
// back: the list filters, sort and page for each unit, and any rationale they had
// started writing for a student.
//
// Signing out does not reload the app, so all of it belongs to the user who set it and
// is dropped as soon as someone else is signed in. Otherwise the next tutor on a shared
// machine would find the last one's unsaved rationales.
@Injectable({providedIn: 'root'})
export class PortfolioMarkingStateService {
  private readonly filters: Map<number, PortfolioListFilters> = new Map();
  private readonly listViews: Map<number, PortfolioListView> = new Map();
  private readonly rationaleDrafts: Map<number, string> = new Map();
  private readonly gradeSaves: Set<number> = new Set();
  private ownerId: number | undefined;

  constructor(private userService: UserService) {}

  public filtersFor(unitId: number): PortfolioListFilters | undefined {
    this.checkOwner();
    const filters = this.filters.get(unitId);
    return filters ? {...filters} : undefined;
  }

  public rememberFilters(unitId: number, filters: PortfolioListFilters): void {
    this.checkOwner();
    this.filters.set(unitId, {...filters});
  }

  public listViewFor(unitId: number): PortfolioListView {
    this.checkOwner();
    return {...(this.listViews.get(unitId) ?? DEFAULT_PORTFOLIO_LIST_VIEW)};
  }

  public rememberListView(unitId: number, view: Partial<PortfolioListView>): void {
    this.listViews.set(unitId, {...this.listViewFor(unitId), ...view});
  }

  public rationaleDraftFor(projectId: number): string | undefined {
    this.checkOwner();
    return this.rationaleDrafts.get(projectId);
  }

  public rememberRationaleDraft(projectId: number, text: string): void {
    this.checkOwner();
    this.rationaleDrafts.set(projectId, text);
  }

  public clearRationaleDraft(projectId: number): void {
    this.checkOwner();
    this.rationaleDrafts.delete(projectId);
  }

  // A grade on its way to the server. Kept here, not on the grade tab, because the tab
  // is rebuilt when the tutor leaves and comes back, and a second save sent while the
  // first is out would race it.
  public isSavingGrade(projectId: number): boolean {
    this.checkOwner();
    return this.gradeSaves.has(projectId);
  }

  public setSavingGrade(projectId: number, saving: boolean): void {
    this.checkOwner();
    if (saving) {
      this.gradeSaves.add(projectId);
    } else {
      this.gradeSaves.delete(projectId);
    }
  }

  private checkOwner(): void {
    const userId = this.userService.currentUser?.id;
    if (userId === this.ownerId) {
      return;
    }

    this.filters.clear();
    this.listViews.clear();
    this.rationaleDrafts.clear();
    this.gradeSaves.clear();
    this.ownerId = userId;
  }
}
