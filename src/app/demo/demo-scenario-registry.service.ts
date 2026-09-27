import {HttpClient} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {BehaviorSubject, EMPTY, Observable, catchError, filter, map, of, tap} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DEMO_TOOLS_AVAILABLE, DemoModeStore} from './demo-mode.store';

export interface DemoStatusHook {
  status: string;
  count: number;
  percentage: number;
  task_abbreviations: string[];
}

export interface DemoPpiHook {
  state: 'available' | 'unavailable';
  unavailable_reason: string | null;
  task_abbreviation: string;
  task_definition_id: number;
  submitted_percentage: number | null;
  completed_percentage: number | null;
  status_distribution: {status: string; percentage: number}[] | null;
}

export interface DemoUnitHook {
  key: string;
  code: string;
  name: string;
  unit_id: number;
  project_id: number;
  ppi: DemoPpiHook;
}

export interface DemoScenarioContract {
  schema_version: number;
  scenario_id: string;
  demo_only: true;
  generated_at: string;
  primary_unit_key: string;
  units: DemoUnitHook[];
  task_lifecycle: {
    unit_key: string;
    total_tasks: number;
    submitted_percentage: number;
    completed_percentage: number;
    statuses: DemoStatusHook[];
  };
  notification_hooks: {
    key: string;
    id: number;
    event: string;
    notification_type: string;
    read: boolean;
    created_at: string;
    link: string;
  }[];
  group_hook: {
    key: string;
    unit_key: string;
    unit_id: number;
    project_id: number;
    group_set_id: number;
    group_id: number;
    name: string;
    member_count: number;
    capacity: number;
    route: string;
  };
  walkthrough_links: {key: string; label: string; route: string}[];
}

@Injectable({providedIn: 'root'})
export class DemoScenarioRegistryService {
  private requestGeneration = 0;
  private readonly scenarioSubject: BehaviorSubject<DemoScenarioContract | null> =
    new BehaviorSubject(null);
  readonly scenario$ = this.scenarioSubject.asObservable();

  constructor(
    private http: HttpClient,
    private demoMode: DemoModeStore,
    @Inject(DEMO_TOOLS_AVAILABLE) private toolsEligible: boolean,
  ) {}

  get scenario(): DemoScenarioContract | null {
    return this.scenarioSubject.value;
  }

  loadForAuthenticatedUser(
    userId: number,
    isCurrentSession: () => boolean = () => true,
  ): Observable<void> {
    const requestGeneration = ++this.requestGeneration;
    const isCurrentRequest = () =>
      requestGeneration === this.requestGeneration && isCurrentSession();
    if (!this.toolsEligible) {
      this.clear();
      return of(void 0);
    }

    return this.http.get<DemoScenarioContract>(`${API_URL}/demo/scenario`).pipe(
      filter(isCurrentRequest),
      tap((scenario) => {
        this.scenarioSubject.next(scenario);
        this.demoMode.configureScenario(scenario.scenario_id, userId);
      }),
      map(() => void 0),
      catchError(() => {
        if (!isCurrentRequest()) {
          return EMPTY;
        }
        // A 404 is the expected answer outside the isolated runtime. Do not
        // infer availability from a build flag or leak the guarded endpoint.
        this.clear();
        return of(void 0);
      }),
    );
  }

  clear(): void {
    this.requestGeneration += 1;
    this.scenarioSubject.next(null);
    this.demoMode.clearScenario();
  }
}
