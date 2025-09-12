export interface Requirement {
  id?: number;
  courseId: number;
  unitId?: number;
  type: 'course' | 'unit';
  category: string;
  description: string;
  minimum?: number;
  maximum?: number;
  requirementSetGroupId: number;
}
