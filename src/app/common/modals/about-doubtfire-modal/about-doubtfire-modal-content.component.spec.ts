import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {AboutDialogData} from './about-dialog-data';
import {AboutDoubtfireModalContent} from './about-doubtfire-modal.component';

describe('AboutDoubtfireModalContent', () => {
  let fixture: ComponentFixture<AboutDoubtfireModalContent>;
  let data: AboutDialogData;

  beforeEach(async () => {
    data = new AboutDialogData();
    data.externalName = 'OnTrack';
    data.mainContributors = [
      {
        login: 'macite',
        name: 'Andrew Cain',
        avatar_url: 'https://example.test/macite.png',
        html_url: 'https://github.com/macite',
      },
      {
        login: 'alexcu',
        name: 'Alex Cummaudo',
        avatar_url: 'https://example.test/alexcu.png',
        html_url: 'https://github.com/alexcu',
      },
      {
        login: 'jakerenzella',
        name: undefined,
        avatar_url: '/assets/images/person-unknown.gif',
        html_url: undefined,
      },
    ];

    await TestBed.configureTestingModule({
      declarations: [AboutDoubtfireModalContent],
      providers: [{provide: MAT_DIALOG_DATA, useValue: data}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutDoubtfireModalContent);
    fixture.detectChanges();
  });

  const cards = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.about__card')) as HTMLElement[];

  it('renders a card with a name and a named avatar for each lead contributor', () => {
    const rendered = cards();
    expect(rendered).toHaveLength(3);

    const expected = ['Andrew Cain', 'Alex Cummaudo', 'jakerenzella'];
    rendered.forEach((card, i) => {
      const name = card.querySelector('.about__person-name') as HTMLElement;
      const img = card.querySelector('img') as HTMLImageElement;
      expect(name.textContent.trim()).toBe(expected[i]);
      expect(img.getAttribute('alt')).toBe(expected[i]);
    });
  });

  it('labels profile links and omits them until a profile URL is known', () => {
    const [andrew, , jake] = cards();
    const link = andrew.querySelector('a.about__icon-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://github.com/macite');
    expect(link.getAttribute('aria-label')).toContain('Andrew Cain on GitHub');
    expect(jake.querySelector('a.about__icon-link')).toBeNull();
  });

  it('keeps a close action in the dialog footer', () => {
    const close = fixture.nativeElement.querySelector(
      'mat-dialog-actions button',
    ) as HTMLButtonElement;
    expect(close.textContent.trim()).toBe('Close');
    expect(close.hasAttribute('mat-dialog-close')).toBe(true);
  });
});
