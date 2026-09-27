import {beforeEach, describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {UserService} from 'src/app/api/services/user.service';
import {DEFAULT_PORTFOLIO_LIST_FILTERS} from './directives/portfolios-list/portfolios-list.component';
import {
  DEFAULT_PORTFOLIO_LIST_VIEW,
  PortfolioMarkingStateService,
} from './portfolio-marking-state.service';

describe('PortfolioMarkingStateService', () => {
  let state: PortfolioMarkingStateService;
  let user: {id: number};

  beforeEach(() => {
    user = {id: 7};
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserService,
          useValue: {
            get currentUser() {
              return user;
            },
          },
        },
      ],
    });
    state = TestBed.inject(PortfolioMarkingStateService);
  });

  it('keeps each unit apart and hands out copies', () => {
    state.rememberFilters(1, {...DEFAULT_PORTFOLIO_LIST_FILTERS, gradeFilter: 3});
    state.rememberListView(1, {pageIndex: 2});

    const filters = state.filtersFor(1);
    filters.gradeFilter = 0;

    expect(state.filtersFor(1).gradeFilter).toBe(3);
    expect(state.filtersFor(2)).toBeUndefined();
    expect(state.listViewFor(1)).toEqual({...DEFAULT_PORTFOLIO_LIST_VIEW, pageIndex: 2});
    expect(state.listViewFor(2)).toEqual(DEFAULT_PORTFOLIO_LIST_VIEW);
  });

  // Signing out does not reload the app, so the next tutor on the same browser tab
  // would otherwise see the last one's unsaved rationale.
  it('drops what one user left once another is signed in', () => {
    state.rememberRationaleDraft(5, 'Half written');
    state.rememberFilters(1, {...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: 'amy'});

    user = {id: 8};

    expect(state.rationaleDraftFor(5)).toBeUndefined();
    expect(state.filtersFor(1)).toBeUndefined();
  });
});
