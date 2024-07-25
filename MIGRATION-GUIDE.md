![Doubtfire Logo](src/assets/icons/android-chrome-192x192.png)

# Doubtfire Web - Angular.js to Angular migration guide

This guide will provide the basic steps you can follow in order to successfully migrate a Doubtfire component from CoffeeScript and Angular.js to TypeScript and Angular.

Here we will demonstrate what to do using the changes associated with the Task Description card.

## Step 0 - Come up with a plan

Before you really get started you need to identify a suitable component to migrate, and come up with a plan for the components new styling.

### Identifying a suitable component to migrate

When picking a component make sure your component **DOES NOT** have any other Angular.js components nested within it. Always start at the bottom and work our way up to the "bigger" components.

Look for components that should be easy to migrate. It will be easier to migrate things that just present data, but in general remember you already have a working component. So it should mostly be a matter of mapping the code across, and changing the styling to switch from bootstrap to material design.

When in doubt... ask. We are happy to make suggestions for components that should be beneficial to migrate.

### Types of migration

- Simple component
- Factory component

#### Simple Components

A simple component migration is what you will encounter in most cases. These types of components are created by a dependency within another component and are only created once within the life of the page.

We picked the Task Description Card as an example of a simple component for this guide as it was relatively straightforward in terms of functionality, and it does not have any other Doubtfire components nested within it.

#### Factory Components

Factory component migration are typically encountered when migrating a modal component. These components are created through a "factory" in AngularJS, which enables them to be created multiple times within the life of the page. When migrating these components, you will be required to migrate the display portion of the component and the factory portion of the component.

We picked the Create New Unit Modal as an example of a factory component for this guide.

### Plan your component's styling

For a component to be successfully migrated, the migrated component must match the styling of the old component. This new styling must be achieved through using [Angular Material](https://material.angular.io) and [Tailwind CSS](https://tailwindcss.com/).

Look for similar [angular components](https://material.angular.io/components/categories) to the [bootstrap components](https://getbootstrap.com/docs/3.4/components/) being used in the component you are migrating. Where there is a simple mapping you can probably just proceed, but if you want to make bigger changes (which is good) then please mock something up and discuss with the team first. We do not want you wasting effort if your ideas are not in line with what we will accept.

For the Task Description Card there is a matching [card component](https://material.angular.io/components/card/overview) in Angular Material with a suitable [example](https://material.angular.io/components/card/examples) we can build from. We can do a first pass and then make any styling fixes if needed at the end.

## Step 1 - Create a branch

Ok, this should be a given but it is always going to be important to isolate the changes for these migrations. So start by checking out a new branch for this change.

For the task description card this was done using the following command in the Terminal:

```bash
git checkout -b migrate/task-description-card
```

## Step 2 - Capture the state of the component before the migration

To be able to easily see how your changes are progressing during the migration, it's important to have a baseline to compare them to. The best way to achieve this is to capture screenshots and notes of the appearance and functionality of the component prior to the migration.

These screenshots and notes will be important later when you go to make a pull request, as you will be required to include them to compare the migrated component with the old component.

You can see an example of these screenshots on the [task description card pull request](https://github.com/doubtfire-lms/doubtfire-web/pull/321) and the [create new unit modal pull request](https://github.com/doubtfire-lms/doubtfire-web/pull/701).

## Step 3 - Create replacement files

### Simple Components

Create a typescript, scss, and html file to replace the coffeescript, scss, and html files from the angular.js project.

For the Task Description Card we had the files:

- task-description-card.coffee
- task-description-card.tpl.html
- task-description-card.scss

In the same folder we can start by creating the following files:

- task-description-card.component.ts
- task-description-card.component.html
- task-description-card.component.scss

Notice the naming convention. When migrating a component we use the format _name_.**component**._extension_.

Add the start of the typescript using something based on the following:

```typescript
import { Component, Input, Inject } from '@angular/core';

@Component({
  selector: 'task-description-card',
  templateUrl: 'task-description-card.component.html',
  styleUrls: ['task-description-card.component.scss'],
})
export class TaskDescriptionCardComponent {
  constructor() {}
}
```

We cant see any of these changes yet, but it is a good clean start so lets commit this before we move on.

```bash
git add task-description-card.component.ts
git add task-description-card.component.html
git add task-description-card.component.scss
# or "git add ." if you have a clean repository and only these files are changed.
git commit -m "NEW: Create initial files for migration of task-description-card"
```

Then we should make sure to push this back to GitHub so that others can see our progress. As this is a new branch you will need set the upstream branch, but if you forget the `git push` will remind you anyway.

```bash
git push --set-upstream origin migrate/task-description-card
```

You should see a suggestion to create a pull request when you add this branch. This is also a good idea. At this stage you can create a [Draft Pull Request](https://github.blog/2019-02-14-introducing-draft-pull-requests/) which will get updated as you push your changes. Use this to get a quick screenshot of the component in action currently. Then you can include this as a "from" image.

See the resulting [commit](933df7b673b5d57dc162fb42f79c511444f5fbe3) and [pull request](https://github.com/doubtfire-lms/doubtfire-web/pull/321). Its great that you can go back and see how things evolved.

### Factory Components

Factory components mostly follow the same file structure as a simple component but will have one additional new file, which will replace the factory that creates the component.

For the create new unit modal component we had the files:
- create-new-unit-modal.coffee
- create-new-unit-modal.tpl.html

The files for the migrated component will be:
- create-new-unit-modal-content.component.ts
- create-new-unit-modal.component.ts
- create-new-unit-modal.component.html

Note the two separate typescript files. The **create-new-unit-modal-content.component.ts** file will contain the logic for the elements within the component, while the **create-new-unit-modal.component.ts** file will contain the logic for creating the component.

The typescript for the **create-new-unit-modal-content.component.ts** file will initially need to look something like this:

```ts
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'create-new-unit-modal-content',
  templateUrl: 'create-new-unit-modal-content.component.html',
})
export class CreateNewUnitModalContentComponent {
  constructor(
    private dialogRef: MatDialogRef<CreateNewUnitModalContentComponent>,
  ) {}
}
```

The typescript for the **create-new-unit-modal.component.ts** file will initially need to look something like this:

```ts
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateNewUnitModalContentComponent } from './create-new-unit-modal-content.component';

@Component({
  selector: 'create-new-unit-modal',
  template: '',
})
export class CreateNewUnitModal {
  constructor(public dialog: MatDialog) {}
  public show(): void {
    this.dialog.open(CreateNewUnitModalContentComponent, {
      width: '500px',
    });
  }
}
```

## Step 4 - Unlink old component and add in new

We want to make sure we can see our progress as quickly as possible. So lets start by replacing the old component with the new one.

There are a few files we need to update to achieve this.

- Remove link to component from the angular module.

  - Open the component's CoffeeScript file and make a note of the name of the module.

    ```coffeescript
    angular.module('doubtfire.projects.states.dashboard.directives.task-dashboard.directives.task-description-card', [])
    ```

    The name is `doubtfire.projects.states.dashboard.directives.task-dashboard.directives.task-description-card`

  - Search for where this is referenced. For the task-description-card this was in file `src/app/projects/states/dashboard/directives/task-dashboard/directives/directives.coffee`... hence the suggestion to search :satisfied:.
  - Remove the reference. This will mean that the component is no longer loaded by angular.js.

- Setup the new component in **doubtfire-angular.module.ts**
  - Import like this:

    #### Simple Component

    ```ts
    import { TaskDescriptionCardComponent } from './projects/states/dashboard/directives/task-dashboard/directives/task-description-card/task-description-card.component';
    ```

    Then add the component name to the list of **declarations** located in **doubtfire-angular.module.ts**.

    ```ts
    declarations: [
      ... // Other declarations
      TaskDescriptionCardComponent,
    ],
    ```

    #### Factory Component
    ```ts
    import { CreateNewUnitModal } from './admin/modals/create-new-unit-modal/create-new-unit-modal.component';
    import { CreateNewUnitModalContent } from './admin/modals/create-new-unit-modal/create-new-unit-modal-content.component';
    ```

    Then add the component name to the list of **declarations** located in **doubtfire-angular.module.ts**.

    ```ts
    declarations: [
      ... // Other declarations
      CreateNewUnitModal,
      CreateNewUnitModalContentComponent,
    ],
    ```

    Finally add the component creator to the list of **providers**.

    ```ts
    providers: [
      ... // Other providers
      CreateNewUnitModal,
    ]
    ```

   Now the component will be available in Angular.
- Remove the old and downgrade the new in **doubtfire-angularjs.module.ts**
  - Remove the line importing the old javascript file:
    ```typescript
    import 'build/src/app/projects/states/dashboard/directives/task-dashboard/directives/task-description-card/task-description-card.js';
    ```
  - Import the new component... _it is the same code as importing to the angular module_.
  - Downgrade to make the new component available to Angular.js

    #### Simple Component

    ```typescript
    DoubtfireAngularJSModule.directive('taskDescriptionCard', downgradeComponent({ component: TaskDescriptionCardComponent }));
    ```

    #### Factory Component
    
    For a factory component you only need to downgrade the component creator, not the contents.

    ```ts
    DoubtfireAngularJSModule.factory('CreateNewUnitModal', downgradeInjectable(CreateNewUnitModal));
    ```


- Update attributes on the new component usage.

  - Search for all of the places where the component was already used (i.e. search for the component HTML tag).
  - Update the property binding style to use the Angular form which is `[property]="value"`.

    For example:

    ```html
    <task-description-card task-def="task.definition" task="task" unit="task.unit()"></task-description-card>
    ```

    Needs to change to:

    ```html
    <task-description-card [task-def]="task.definition" [task]="task" [unit]="task.unit()"></task-description-card>
    ```

- Add matching inputs into your components typescript declaration. These use the syntax `@Input() name: type;`. For the task description card we use:

  ```ts
  export class TaskDescriptionCardComponent {
    @Input() task: any;
    @Input() taskDef: any;
    @Input() unit: any;
    ...
  }
  ```

Now we can compile to see if this has all worked... :crossed_fingers:. When you change the config in this way I generally find you need to kill any old build processes and start them again. So we can compile now using:

```bash
npm start
```

Open your local copy of Doubtfire and navigate somewhere that you can see the lack of the old component. As we have no HTML yet, there should be nothing in its place but we are mostly checking that we have connected this all up correctly.

Once things are working make sure to commit and push your changes. This will update your draft pull request as well.

Now we are on to the "real" work.

## Step 5 - Migrate the HTML, CoffeeScript, and SCSS

This is where things are going to depend on what you are migrating. Hopefully you have already got a plan for this...

For the task description card I used the [mat-card](https://material.angular.io/components/card/examples) as the main component I needed to migrate to. I did this with the following steps:

1. Copy in the current bootstrap HTML
2. Identify update to wrap in the material card component (save and test)
3. Update the header (save and test)
4. Update the footer to actions (save and test)
5. Scan for other bootstrap tags and replace.

As I needed it I copied across the CoffeeScript code into the TypeScript component. This included switching the hyperlinks to use buttons, and including the addition of the file saver to make it easy to save the downloaded task sheets and resources as a click action rather than opening a new page with the links.

At the end I made sure to check that **all functionality** from the old component had a matching set of code in the new component.

Here are a few things to watch out for when doing this migration:

- Switching `ng-show` to `[hidden]` remember to change the boolean expression.
- Font awesome icons needs to change to Material Design icons using [mat-icon](https://material.angular.io/components/icon/overview) - check out the [icon list](https://material.io/resources/icons/?style=baseline).
- Make sure to add [aria-hidden](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-hidden_attribute) and [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) to ensure icons and images are screen reader friendly.
- Make sure to run `ng lint` at the end of this process to make sure your TypeScript code is looking good!

### A note on porting the CSS of components

In Doubtfire's AngularJS codebase, the components use bootstrap classes such as `card-sm` or `card-danger`. The eventual goal of the rewrite is to remove this Bootstrap dependancy as we are moving to Angular Material. As such, when the new components are being created, these styles need to be replaced with Angular Material equivalents, or a similar component design needs to be written which can replace the old one.

These bootstrap components are usually located in the `class` of the components, for example:
- `class="card-heading"`, `class="card-body"` would need to be recreated with: https://material.angular.io/components/card/overview
- `class="text-muted"` would be recreated with: https://material.angular.io/guide/typography

Once things are all working... you can delete the old CoffeeScript, HTML and SCSS files. These are no longer needed... so they can go!

Check the files in these pull requests for all of the changes:
- [Task Description Card](https://github.com/doubtfire-lms/doubtfire-web/pull/321/files)
- [Create New Unit Modal](https://github.com/doubtfire-lms/doubtfire-web/pull/701/files)

## Step 6 - Create the Pull Request

Now it is time to update the Pull Request. Please ensure the pull request contains two screenshots for each use-case of the component, showing the old component (before) and the new component (after). The component can also be demonstrated in a video which can be directly uploaded to the Pull Request (please do not link to another hosting platform). Once you have added this, make sure to note any changes that the team should check. You want to make sure that you dont break things when then is merged in. If you think everything is ready then switch from a draft to full PR... As long as things are tidy, and you have clear screenshots to show that everything is working, you can expect things to be merged quickly or for you to get some instructions on what to change.

## Conclusion

Hopefully this has provided some useful steps that will mean you can quickly and efficiently migrate the Doubtfire components. We are all really looking forward to switching to the new Angular approach, and trying to keep things more up to date going forward.

Many thanks for your contributions on behalf of the Doubtfire team!
