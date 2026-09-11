import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map, of} from 'rxjs';
import {DemoModeStore} from './demo-mode.store';

const DEMO_UNIT_CODE = 'DEMO20007';

type JsonRecord = Record<string, unknown>;

export function filterProjectCollectionForQuietMode(body: unknown): unknown {
  if (Array.isArray(body)) {
    return filterProjects(body);
  }

  if (isRecord(body) && Array.isArray(body.data)) {
    return {...body, data: filterProjects(body.data)};
  }

  return body;
}

function filterProjects(projects: unknown[]): unknown[] {
  const preferred = projects.filter((project) => projectUnitCode(project) === DEMO_UNIT_CODE);
  return preferred.length > 0 ? preferred : projects.slice(0, 1);
}

function projectUnitCode(project: unknown): string | null {
  if (!isRecord(project)) {
    return null;
  }

  const unit = isRecord(project.unit) ? project.unit : null;
  const value = unit?.code ?? project.unit_code ?? project.unitCode;
  return typeof value === 'string' ? value.toUpperCase() : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class DemoDataMaskInterceptor implements HttpInterceptor {
  constructor(private demoMode: DemoModeStore) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.demoMode.shouldMaskApiData) {
      return next.handle(request);
    }

    if (request.method === 'GET' && /\/api\/notifications\/?$/.test(request.url)) {
      return of(new HttpResponse({body: [], status: 200, url: request.urlWithParams}));
    }

    if (request.method === 'GET' && /\/api\/notifications\/unread_count\/?$/.test(request.url)) {
      return of(new HttpResponse({body: {count: 0}, status: 200, url: request.urlWithParams}));
    }

    if (request.method === 'GET' && /\/api\/projects\/?$/.test(request.url)) {
      return next
        .handle(request)
        .pipe(
          map((event) =>
            event instanceof HttpResponse
              ? event.clone({body: filterProjectCollectionForQuietMode(event.body)})
              : event,
          ),
        );
    }

    return next.handle(request);
  }
}
