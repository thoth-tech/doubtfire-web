
# Ontrack Component review

## Team Member Name

AMOS SAJI
Studen ID: 221118434

## Component Name

`group-set-manager`

Files included in this component:
- `group-set-manager.coffee`
- `group-set-manager.tpl.html`
- `group-set-manager.scss`

## Component Purpose

The purpose of the `group-set-manager` component is to manage group memberships within a group set context, primarily for tutors. This component allows the addition and removal of group members and updates to group information. It provides an interface for managing group members, updating group names, and handling toolbar visibility based on user roles.

## Component Outcomes and Interactions

The expected outcomes for the `group-set-manager` component include:
- Tutors can add new members to a group.
- Tutors can update the group's name.
- The component controls the visibility of the member panel toolbar based on the presence of a unit role.

Interactions:
- Accepts and processes the following data objects:
  - `@Input() unit`: The current unit context.
  - `@Input() unitRole`: The role of the user within the unit.
  - `@Input() project`: The project associated with the group.
  - `@Input() selectedGroupSet`: The currently selected group set.
  - `@Input() showGroupSetSelector`: Boolean to show or hide the group set selector.

## Component Migration Plan

### Steps for Migration:
1. **Convert CoffeeScript to TypeScript**:
   - Migrate the logic from `group-set-manager.coffee` to TypeScript, ensuring that all AngularJS components and services are appropriately updated to Angular (Angular 2+).
2. **Update HTML template**:
   - Ensure the HTML template (`group-set-manager.tpl.html`) is compatible with Angular's newer version. Replace any deprecated AngularJS directives with their Angular equivalents.
3. **Migrate SCSS styles**:
   - Confirm that the SCSS styles are compatible with the migrated TypeScript component. Modify any class or id selectors to match changes in the HTML structure, if necessary.
4. **Testing**:
   - Test the migrated component in isolation to ensure it functions correctly.
   - Integrate the component back into the application and run end-to-end tests to verify that it works within the broader system.

### Comparison:
- **Original (CoffeeScript)**: `group-set-manager.coffee`
- **Migrated (TypeScript)**: `group-set-manager.component.ts`

## Component Review Checklist

- [ ] Ability to collect group details and display them to the user.
- [ ] Succeeds in adding a new member to a group.
- [ ] Correctly updates group names.
- [ ] Handles errors such as missing or invalid group details.
- [ ] Toolbar visibility correctly toggles based on user role.
- [ ] All functionalities are migrated and working correctly in TypeScript.