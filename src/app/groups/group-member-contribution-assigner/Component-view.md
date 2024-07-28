# OnTrack Component Review

**Team Member Name**  
Xin Huang

## Component Name
**Component Name:** group-member-contribution-assigner

**Files in the Component:**
- `group-member-contribution-assigner.coffee`
- `group-member-contribution-assigner.tpl.html`
- `group-member-contribution-assigner.scss`

## Component Purpose
The primary purpose of this component is to allow team members to rate each other's contributions in a group task assessment. It displays team member names, target grades, and provides a rating interface for contributions.

## Component Outcomes and Interactions
**Expected Outcomes:**  
- Team members can assign ratings to each other.
- Displays contribution percentages based on ratings.

**Interactions:**  
- Takes in `task`, `project`, and `team` data objects.
- Uses `gradeService` to manage grade-related functions.

## Component Migration Plan
1. **Identify Dependencies:** List out AngularJS-specific dependencies and prepare Angular equivalents.
2. **Recreate Component Structure:** Build the component in Angular with equivalent functionality.
3. **Replace Bootstrap with Angular Material:** Replace Bootstrap classes with Angular Material components.
4. **Testing and Validation:** Ensure the new component maintains the same functionality and appearance.

## Component Review Checklist
- [ ] Ability to collect and display ratings
- [ ] Data validation and error handling for ratings
- [ ] Accessibility considerations (e.g., screen reader support)

## Discussion with Client (Andrew Cain)
Include any feedback or additional considerations discussed with Andrew Cain before starting the migration work.