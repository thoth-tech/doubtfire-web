import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'tasksForGroupset'
})
export class TasksForGroupsetPipe implements PipeTransform {
  transform(tasks: any[], groupSet: any): any[] {
    if (!tasks) return tasks;

    return tasks.filter(task => {
      return (task.definition.groupSet === groupSet) || (!task.definition.groupSet && !groupSet);
    });
  }
}
