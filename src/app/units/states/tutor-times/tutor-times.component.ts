import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'tutor-times',
  templateUrl: 'tutor-times.component.html',
  styleUrls: ['tutor-times.component.scss'],
})
export class TutorTimesComponent implements OnInit, OnDestroy {
  hours: number = 0;
  minutes: number = 0;
  seconds: number = 0;
  totalSeconds: number = 0;
  isRunning: boolean = false;
  timerSubscription: Subscription | null = null;

  // Manual input properties for Start time
  manualHours: number = 0;
  manualMinutes: number = 0;
  manualSeconds: number = 0;

  // Manual input properties for Finish time
  manualFinishHours: number = 0;
  manualFinishMinutes: number = 0;
  manualFinishSeconds: number = 0;

  // Saved values for Start and Finish times (in seconds)
  savedStartSeconds: number = 0;
  savedFinishSeconds: number = 0;
  isSaved: boolean = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    // Initialize if needed
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  startTimer(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.timerSubscription = interval(1000).subscribe(() => {
        this.totalSeconds++;
        this.updateDisplay();
      });
    }
  }

  stopTimer(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.timerSubscription?.unsubscribe();
      this.timerSubscription = null;
    }
  }

  resetTimer(): void {
    this.stopTimer();
    this.totalSeconds = 0;
    this.updateDisplay();
    this.isSaved = false;
    this.savedStartSeconds = 0;
    this.savedFinishSeconds = 0;
    this.errorMessage = null;
  }

  updateDisplay(): void {
    this.hours = Math.floor(this.totalSeconds / 3600);
    this.minutes = Math.floor((this.totalSeconds % 3600) / 60);
    this.seconds = this.totalSeconds % 60;
  }

  saveManualTime(): void {
    // Normalize and validate inputs
    this.manualHours = Math.max(0, this.manualHours || 0);
    this.manualMinutes = Math.min(59, Math.max(0, this.manualMinutes || 0));
    this.manualSeconds = Math.min(59, Math.max(0, this.manualSeconds || 0));
    this.manualFinishHours = Math.max(0, this.manualFinishHours || 0);
    this.manualFinishMinutes = Math.min(59, Math.max(0, this.manualFinishMinutes || 0));
    this.manualFinishSeconds = Math.min(59, Math.max(0, this.manualFinishSeconds || 0));

    // Calculate Start and Finish times in seconds
    const startTotalSeconds =
      this.manualHours * 3600 + this.manualMinutes * 60 + this.manualSeconds;
    const finishTotalSeconds =
      this.manualFinishHours * 3600 + this.manualFinishMinutes * 60 + this.manualFinishSeconds;

    // Validate: Finish time must be after Start time
    if (finishTotalSeconds <= startTotalSeconds) {
      this.errorMessage = 'Finish time must be after Start time.';
      this.isSaved = false;
      return;
    }

    // Save the values
    this.savedStartSeconds = startTotalSeconds;
    this.savedFinishSeconds = finishTotalSeconds;
    this.isSaved = true;
    this.errorMessage = null;
  }

  applyManualTime(): void {
    if (!this.isSaved) {
      this.errorMessage = 'Please save the times before applying.';
      return;
    }

    // Calculate the difference using saved values
    const timeDifference = this.savedFinishSeconds - this.savedStartSeconds;
    this.totalSeconds = timeDifference;
    this.updateDisplay();

    // Reset manual inputs and saved state
    this.manualHours = 0;
    this.manualMinutes = 0;
    this.manualSeconds = 0;
    this.manualFinishHours = 0;
    this.manualFinishMinutes = 0;
    this.manualFinishSeconds = 0;
    this.isSaved = false;
    this.errorMessage = null;
  }

  formatNumber(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  // New method to format total seconds into HH:MM:SS
  formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${this.formatNumber(hours)}:${this.formatNumber(minutes)}:${this.formatNumber(seconds)}`;
  }
}
