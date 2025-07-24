import {Pipe, PipeTransform} from '@angular/core';
import _ from 'lodash';

@Pipe({name: 'humanize', standalone: true})
export class HumanizePipe implements PipeTransform {
  transform(input: string): string {
    return _.startCase(_.toLower(input));
  }
}
