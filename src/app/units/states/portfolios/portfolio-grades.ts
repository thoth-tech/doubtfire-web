import {Project} from 'src/app/api/models/project';

export interface PortfolioGradeBand {
  name: string;
  // The unit grade the band awards, so a unit's own grade names can label it.
  gradeValue: number;
  // The lowest mark in the band. Marks can arrive from a grades CSV as well as
  // from the buttons, so a mark is placed in a band by range, not by lookup.
  minimum: number;
  scores: number[];
}

// The marks a tutor can award for a portfolio, grouped by the grade each range earns.
export const PORTFOLIO_GRADE_BANDS: readonly PortfolioGradeBand[] = [
  {name: 'Fail', gradeValue: -1, minimum: 0, scores: [0, 10, 20, 30, 40, 44]},
  {name: 'Pass', gradeValue: 0, minimum: 50, scores: [50, 53, 55, 57]},
  {name: 'Credit', gradeValue: 1, minimum: 60, scores: [60, 63, 65, 67]},
  {name: 'Distinction', gradeValue: 2, minimum: 70, scores: [70, 73, 75, 77]},
  {
    name: 'High Distinction',
    gradeValue: 3,
    minimum: 80,
    scores: [80, 83, 85, 87, 90, 93, 95, 97, 100],
  },
];

export function gradeBandFor(score: number | null | undefined): PortfolioGradeBand | undefined {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return undefined;
  }

  return [...PORTFOLIO_GRADE_BANDS].reverse().find((band) => score >= band.minimum);
}

// Every project starts with a grade of 0, and a grade can only be saved with a
// rationale, so a 0 with no rationale means nobody has graded the portfolio yet.
export function isProjectGraded(
  project: Pick<Project, 'grade' | 'gradeRationale'> | null | undefined,
): boolean {
  if (!project || project.grade === null || project.grade === undefined) {
    return false;
  }

  return project.grade !== 0 || !!project.gradeRationale?.trim();
}
