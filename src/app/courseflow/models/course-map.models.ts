import {Unit, UnitDefinition} from 'src/app/api/models/doubtfire-model';

export type CourseUnit = Unit | UnitDefinition;

export interface SlotContext {
  yearIndex: number;
  trimesterKey: 'trimester1' | 'trimester2' | 'trimester3';
  slotIndex: number;
}

export interface CourseYear {
  year: number;
  trimester1: (CourseUnit | null)[];
  trimester2: (CourseUnit | null)[];
  trimester3: (CourseUnit | null)[];
}

export interface CourseMapState {
  years: CourseYear[];
  requiredUnits: Unit[]; // Actual Unit instances for course requirements
  allRequiredUnits: Unit[]; // All available Unit instances
  electiveUnits: Unit[]; // Actual course instances for electives
  maxElectiveUnits: number;
}

export const TRIMESTER_KEYS: readonly ('trimester1' | 'trimester2' | 'trimester3')[] = [
  'trimester1',
  'trimester2',
  'trimester3',
] as const;
