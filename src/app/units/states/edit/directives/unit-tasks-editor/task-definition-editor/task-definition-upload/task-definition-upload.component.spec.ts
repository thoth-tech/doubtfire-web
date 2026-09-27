import {describe, expect, it} from 'vitest';
import {TaskDefinitionUploadComponent} from './task-definition-upload.component';

function uploadEditor() {
  const component = new TaskDefinitionUploadComponent({IsTiiEnabled: {value: false}} as never);
  component.taskDefinition = {uploadRequirements: []} as never;
  return component;
}

describe('TaskDefinitionUploadComponent', () => {
  it('gives every file a different key after a file is removed and another added', () => {
    const component = uploadEditor();

    component.addUpReq();
    component.addUpReq();
    component.addUpReq();
    component.removeUpReq(component.taskDefinition.uploadRequirements[0]);
    component.addUpReq();

    const keys = component.taskDefinition.uploadRequirements.map((requirement) => requirement.key);
    expect(keys).toEqual(['file0', 'file1', 'file2']);
  });

  it('removes only the row that was picked when two rows share a key', () => {
    const component = uploadEditor();
    const first = {key: 'file1', name: 'Code', type: 'code'};
    const second = {key: 'file1', name: 'Report', type: 'document'};
    component.taskDefinition.uploadRequirements = [first, second];

    component.removeUpReq(first);

    expect(component.taskDefinition.uploadRequirements).toEqual([
      {key: 'file0', name: 'Report', type: 'document'},
    ]);
  });
});
