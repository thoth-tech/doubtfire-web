import { Entity } from "../entity";


const KEYS = [
  'student_id',
  'project_id',
  'student_name',
  'target_grade',
];
export class GroupMember extends Entity {

  public student_id: number;
  public project_id: number;
  student_name: string;
  target_grade: number; 
  rating: number;
  percent: string;
  confRating: number;
  overStar: number;
 
  toJson(): any {
    return {
      groupMember: super.toJsonWithKeys(KEYS)
    };
  }

  public updateFromJson(data: any): void {
    this.setFromJson(data, KEYS);
    this.confRating = 0 
    this.rating = 0 
    this.percent = "0"
    this.overStar = 0
  }
  public get key(): string {
    return "";
  }
  public keyForJson(json: any): string {
    return json.id;
  }  
}




