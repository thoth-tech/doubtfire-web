import { Injectable } from '@angular/core';
import moment from 'moment';

@Injectable({
  providedIn: 'root',
})
export class UtilService {



  fromNow(date: Date | string): string {
    return moment(new Date(date)).fromNow();
  }


  titleize(input: string): string {
    return input
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }


  humanize(input: string): string {
    return input
      .replace(/[_\-]+/g, ' ')         // Replace underscores/dashes with space
      .replace(/\s+/g, ' ')            // Remove extra spaces
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Syncs browser autofill value with Angular's view value.
   */
  syncAutoFill(
    element: HTMLInputElement,
    pristine: boolean,
    setViewValue: (val: string) => void
  ): void {
    const origVal = element.value;
    setTimeout(() => {
      const newVal = element.value;
      if (pristine && origVal !== newVal) {
        setViewValue(newVal);
      }
    }, 500);
  }
}
