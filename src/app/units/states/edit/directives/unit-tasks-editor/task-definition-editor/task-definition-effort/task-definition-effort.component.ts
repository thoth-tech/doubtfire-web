import { Component, Input, OnDestroy } from '@angular/core';
import { TaskDefinition } from 'src/app/api/models/task-definition';
import { Unit } from 'src/app/api/models/unit';
import { SidekiqJobService } from 'src/app/api/services/sidekiq-job.service';
import { TaskDefinitionService } from 'src/app/api/services/task-definition.service';
import { Subject, interval, switchMap, takeWhile, Subscription } from 'rxjs';

@Component({
  selector: 'f-task-definition-effort',
  templateUrl: 'task-definition-effort.component.html',
  styleUrls: ['task-definition-effort.component.scss'],
})
export class TaskDefinitionEffortComponent implements OnDestroy {
  @Input() taskDefinition: TaskDefinition;
  @Input() staffView: boolean;

  constructor(
    private TaskDefinitionService: TaskDefinitionService,
    private SidekiqJobService: SidekiqJobService,
  ) {}

  enablePrediction = true;

  isPredicting = false;
  predictionStatus: 'queued' | 'working' | 'retrying' | 'complete' | 'stopped' | 'failed' | 'interrupted';
  jobId: string | null = null;

  private pollSub?: Subscription;

  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  runPrediction() {
    if (!this.taskDefinition?.id) return;

    this.isPredicting = true;
    this.predictionStatus = 'queued';

    this.TaskDefinitionService.predictEffort(this.taskDefinition).subscribe({
      next: (res: any) => {
        this.predictionStatus = 'working';
        const jobId = res.job_id;
        this.jobId = jobId;

        const resultSubject = new Subject<any>();

        this.SidekiqJobService.setJob(
          jobId,
          'Predicting effort',
          resultSubject
        );

        this.pollJob(jobId, resultSubject);
      },
      error: () => {
        this.predictionStatus = 'failed';
        this.isPredicting = false;
      },
    });
  }

  pollJob(jobId: string, resultSubject: Subject<any>) {
    this.pollSub = interval(2000).pipe(
      switchMap(() => this.SidekiqJobService.getSidekiqJob(jobId)),
      takeWhile(job => job.status !== 'complete' && job.status !== 'failed', true)
    ).subscribe({
      next: (job) => {
        this.predictionStatus = (job.status || 'working').toLowerCase() as any;

        this.SidekiqJobService.setJob(
          jobId,
          'Predicting effort',
          resultSubject,
          job
        );

        if (job.status === 'complete') {
          let result: any;

          try {
            result = typeof job.result === 'string'
              ? JSON.parse(job.result)
              : job.result;
          } catch {
            result = null;
          }

          this.taskDefinition.predicted_effort = Number(result?.predicted_effort ?? 0);

          this.predictionStatus = 'complete';
          this.stopPolling();
        }

        if (job.status === 'failed') {
          this.predictionStatus = 'failed';
          console.error('Job failed:', job.message || job.result);
          this.stopPolling();
        }
      },
      error: () => {
        this.predictionStatus = 'failed';
        this.cleanup(jobId);
      }
    });
  }

  stopPolling() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
    this.isPredicting = false;
  }

  cleanup(jobId: string) {
    this.isPredicting = false;
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
    this.SidekiqJobService.removeJob(jobId);
  }

  ngOnDestroy() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }
}
