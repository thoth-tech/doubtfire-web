![Doubtfire Logo](src/assets/icons/android-chrome-192x192.png)

# Contributing to Doubtfire Web

We welcome additions and extensions to Doubtfire that help progress our goal of supporting student learning through frequent formative feedback and delayed summative assessment.

This guide provides high-level details on how to contribute to the Doubtfire Web repository.

Before continuing, **please read the [contributing document](https://github.com/doubtfire-lms/doubtfire-deploy/blob/development/CONTRIBUTING.md)**, as this outlines the Git workflow you should be following.

## Table of Contents

- [Contributing to Doubtfire Web](#contributing-to-doubtfire-web)
  - [Table of Contents](#table-of-contents)
  - [Project structure](#project-structure)
  - [Testing](#testing)
  - [Formatting](#formatting)
  - [Component conventions](#component-conventions)

## Project structure

The Angular application lives under `src/app`.

- `src/app/api/models` contains client-side models for Doubtfire data.
- `src/app/api/services` contains services used to access and work with API data.
- `src/app/api/fixtures` contains API-related fixture data.
- `src/app/common` contains components and other UI code shared by multiple features.
- Feature-specific code lives in feature folders under `src/app`, such as
  `account`, `admin`, `dashboard`, `projects`, `tasks`, and `units`.
- Keep components that belong to one feature with that feature rather than
  moving them into `common`.
- Components wired through the main Angular module use `standalone: false`.
- Doubtfire component selectors use the `f-` prefix.
- New non-standalone components must be imported and declared in
  `src/app/doubtfire-angular.module.ts`.
- `src/main.ts` bootstraps `DoubtfireAngularModule`, so registering a
  non-standalone component in that module is required before it can be used.
- Follow the structure and naming of a nearby component when adding new
  component TypeScript, template, style, and test files.

## Testing

After installing all the dependencies, to run the front-end Angular tests, run the following command:

```shell
npm test
```

### Formatting

- [ESLint] is used in the project to enforce code style and should be
  configured in your [editor](https://eslint.org/docs/user-guide/integrations).
- [Prettier] is also used and applied automatically by ESLint.

We also use a number of framework plugins:

- [TypeScript ESLint]
- [Angular ESLint]

You can check this manually by running:

```shell
npm run lint
```

You can ask ESLint to fix issues by running:

```shell
npm run lint:fix
```

Please note that not all issues can be fixed by ESLint and Prettier.

## Component conventions

The Angular.js migration is complete, so new work should follow the current
Angular application structure rather than the old migration process.

When adding a component:

- place shared components under `src/app/common`;
- place feature-specific components in the relevant feature folder;
- use the `f-` selector prefix;
- set `standalone: false` for components registered with the main module; and
- import and add the component to the `declarations` in
  `src/app/doubtfire-angular.module.ts`.

Check a nearby existing component before adding a new one so its location,
naming, and module registration match the surrounding feature.

[ESLint]: https://eslint.org/
[Prettier]: https://prettier.io/
[TypeScript ESLint]: https://github.com/typescript-eslint/typescript-eslint
[Angular ESLint]: https://github.com/angular-eslint/angular-eslint