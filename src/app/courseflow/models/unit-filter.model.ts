import { Unit } from 'src/app/api/models/doubtfire-model';

export interface UnitWithFilterProps extends Unit {
  level?: number;
  specialization?: string;
  year?: number;
}
