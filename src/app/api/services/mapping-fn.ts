import moment from 'moment';

export class MappingFunctions {
  private static mapDateValueToDay(value: unknown, preserveDatePrefix: boolean = false): Date {
    if (typeof value === 'string') {
      const dateOnlyPattern = preserveDatePrefix
        ? /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/
        : /^(\d{4})-(\d{2})-(\d{2})$/;
      const dateOnlyParts = dateOnlyPattern.exec(value);
      if (dateOnlyParts) {
        // Date parses bare ISO dates as UTC. Some API fields also encode known civil dates as
        // midnight timestamps. Construct those values from their calendar components so they
        // do not shift west of UTC; ordinary timestamp mappings remain instant-based.
        return new Date(
          Number(dateOnlyParts[1]),
          Number(dateOnlyParts[2]) - 1,
          Number(dateOnlyParts[3]),
        );
      }
    }

    const jsonDate = value instanceof Date ? value : new Date(value as string | number);
    return new Date(jsonDate.getFullYear(), jsonDate.getMonth(), jsonDate.getDate());
  }

  public static mapDateToEndOfDay(data, key, _entity, _params?) {
    const result = MappingFunctions.mapDateValueToDay(data[key]);
    result.setHours(23, 59, 59, 999); // all dates map to end of day
    return result;
  }

  public static mapDateToDay(data, key: string, _entity, _params?) {
    return MappingFunctions.mapDateValueToDay(data[key]);
  }

  public static mapCivilDateToDay(data, key: string, _entity, _params?) {
    return MappingFunctions.mapDateValueToDay(data[key], true);
  }

  public static mapDate(data, key: string, _entity, _params?) {
    return new Date(data[key]);
  }

  public static mapDayToJson<T>(entity: T, key: string): string {
    if (entity[key]) {
      const dateValue = moment.isMoment(entity[key]) ? entity[key].toDate() : entity[key];
      const month = dateValue.getMonth() + 1;
      const day = dateValue.getDate();
      return `${dateValue.getFullYear()}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    } else {
      return undefined;
    }
  }

  public static minutesMs(value: number): number {
    return 1000 * 60 * value;
  }

  public static hourMs(value: number): number {
    return 60 * this.minutesMs(1) * value;
  }

  public static dayMs(value: number): number {
    return 24 * this.hourMs(1) * value;
  }

  public static weeksMs(value: number): number {
    return 7 * this.dayMs(1) * value;
  }

  public static step(start: number, limit: number, stepValue: number): number[] {
    const result: number[] = [];

    for (let val = start; val <= limit; val += stepValue) {
      result.push(val);
    }

    return result;
  }

  /**
   * Add a number of days to a date.
   *
   * @param date starting date
   * @param days days to add
   * @returns the date that is `days` days after `date`
   */
  public static addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + MappingFunctions.dayMs(days));
  }

  /**
   * Add a number of weeks to a date.
   *
   * @param date starting date
   * @param weeks days to add
   * @returns the date that is `days` days after `date`
   */
  public static addWeeks(date: Date, weeks: number): Date {
    return new Date(date.getTime() + MappingFunctions.weeksMs(weeks));
  }

  /**
   * Calculate the time between two dates
   *
   * @param date1 days from this date
   * @param date2 to this date
   * @returns the time from date1 to date2
   */
  public static timeBetween(date1: Date, date2: Date): number {
    return date2.getTime() - date1.getTime();
  }

  /**
   * Calculate the number of days between two dates
   *
   * @param date1 days from this date
   * @param date2 to this date
   * @returns the days from date1 to date2
   */
  public static daysBetween(date1: Date, date2: Date): number {
    const diff = this.timeBetween(date1, date2);
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  /**
   * Calculate the number of days between two dates
   *
   * @param date1 days from this date
   * @param date2 to this date
   * @returns the days from date1 to date2
   */
  public static weeksBetween(date1: Date, date2: Date): number {
    const diff = this.daysBetween(date1, date2);
    return Math.ceil(diff / 7);
  }

  /**
   * Calculate the date that is a number of days after a given date
   *
   * @param date start date
   * @param days number of days to add
   * @returns the date that is that many days after the start date
   */
  public static daysAfter(date: Date, days: number): Date {
    return new Date(date.getTime() + this.dayMs(days));
  }
}
