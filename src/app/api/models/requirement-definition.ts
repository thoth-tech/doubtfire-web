export interface Requirement {
  id: number;
  unitId: number;
  courseId: number;
  type: string;
  category: string;
  description: string;
  minimum: number;
  maximum: number;
  requirementSetGroupId: number;
}
