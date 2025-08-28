import { TutorSession } from './session-data.model';

export const MOCK_SESSIONS: TutorSession[] = [
  {
    tutorId: 1,
    tutorName: 'Alice Smith',
    unitId: 101,
    unitName: 'SIT123',
    projectId: 201,
    projectName: 'Assignment 1',
    sessionStart: '2025-07-20T10:00:00Z',
    sessionEnd: '2025-07-20T11:30:00Z',
    durationMinutes: 90,
    tasksMarked: 5
  },
  {
    tutorId: 2,
    tutorName: 'Bob Lee',
    unitId: 102,
    unitName: 'SIT456',
    projectId: 202,
    projectName: 'Project A',
    sessionStart: '2025-07-21T09:00:00Z',
    sessionEnd: '2025-07-21T10:15:00Z',
    durationMinutes: 75,
    tasksMarked: 3
  },
  {
    tutorId: 1,
    tutorName: 'Alice Smith',
    unitId: 101,
    unitName: 'SIT123',
    projectId: 201,
    projectName: 'Assignment 1',
    sessionStart: '2025-07-23T13:00:00Z',
    sessionEnd: '2025-07-23T14:00:00Z',
    durationMinutes: 60,
    tasksMarked: 4
  }
];
