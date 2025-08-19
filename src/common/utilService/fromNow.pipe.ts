import {Pipe, PipeTransform} from '@angular/core';
import * as moment from 'moment';

@Pipe({name: 'fromNow', standalone: true})
export class FromNowPipe implements PipeTransform {
  transform(date: Date | string): string {
    return moment(new Date(date)).fromNow();
  }
}
