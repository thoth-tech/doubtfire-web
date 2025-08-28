export interface TutorSession {
  tutorId: number;
  tutorName: string;
  unitId: number;
  unitName: string;
  projectId: number;
  projectName: string;
  sessionStart: string; // ISO date
  sessionEnd: string;   // ISO date
  durationMinutes: number;
  tasksMarked: number;
}
