import {Unit} from './doubtfire-model';
import {Requirement} from './requirement';

export interface RequirementSet {
  id?: number;
  requirementSetGroupId: number;
  description: string;
  unitId?: number;
  requirementId: number;
  unit?: Unit; // Optional populated unit data
  requirement?: Requirement; // Optional populated requirement data
}

