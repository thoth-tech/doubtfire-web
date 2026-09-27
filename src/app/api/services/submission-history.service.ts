import {EntityService} from 'ngx-entity-service';
import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map} from 'rxjs';
import {SubmissionHistory} from 'src/app/api/models/submission-history';
import {Task} from 'src/app/api/models/task';
import API_URL from 'src/app/config/constants/apiUrl';

export interface StudentSubmissionVersion {
  id: number;
  versionOrder: number;
  timestamp: Date | null;
  current: boolean;
  available: boolean;
}

export interface StudentSubmissionHistory {
  versions: StudentSubmissionVersion[];
  processing: boolean;
}

@Injectable()
export class SubmissionHistoryService extends EntityService<SubmissionHistory> {
  protected readonly endpointFormat =
    'projects/:project_id:/task_def_id/:td_id:/submission_histories/:id:';

  constructor(private historyHttp: HttpClient) {
    super(historyHttp, API_URL);

    this.mapping.addKeys(
      'id',
      'taskId',
      'createdAt',
      'hasSubmissionFiles',
      'overseerAssessmentId',
      {
        keys: ['timestamp', 'submission_timestamp'],
        toEntityFn: (data) => new Date(Number(data['submission_timestamp']) * 1000),
      },
      ['timestampString', 'submission_timestamp'],
    );
  }

  public createInstanceFrom(_json: object, task?: Task): SubmissionHistory {
    return new SubmissionHistory(task);
  }

  public queryStudentHistory(task: Task): Observable<StudentSubmissionHistory> {
    return this.historyHttp
      .get<
        Array<{
          id: number;
          version_order?: number;
          submission_timestamp: string;
          current?: boolean;
          status?: string;
          has_submission_files?: boolean;
        }>
      >(
        `${API_URL}/projects/${task.project.id}/task_def_id/${task.definition.id}/submission_histories`,
        {
          observe: 'response',
        },
      )
      .pipe(
        map((response) => ({
          processing: response.status === 202,
          versions: (response.body ?? []).map((version, index) => {
            const timestamp = Number(version.submission_timestamp) * 1000;
            return {
              id: version.id,
              versionOrder: version.version_order ?? index + 1,
              timestamp: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : null,
              current: version.current === true,
              available: version.status === 'available' || version.has_submission_files === true,
            };
          }),
        })),
      );
  }

  public studentArchiveUrl(task: Task, versionId: number): string {
    return `${API_URL}/projects/${task.project.id}/task_def_id/${task.definition.id}/submission_histories/${versionId}/files`;
  }

  public queryForTask(task: Task): Observable<SubmissionHistory[]> {
    return this.query(
      {
        project_id: task.project.id,
        td_id: task.definition.id,
      },
      {constructorParams: task},
    );
  }
}
