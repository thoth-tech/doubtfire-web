import {Pipe, PipeTransform} from '@angular/core';
import _ from 'lodash';

@Pipe({name: 'titleize', standalone: true})
export class TitleizePipe implements PipeTransform {
  transform(input: string): string {
    return _.startCase(_.toLower(input));
  }
}
