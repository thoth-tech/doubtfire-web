import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TutorialsComponent} from './tutorials.component';

describe('TutorialsComponent', () => {
  let component: TutorialsComponent;
  let fixture: ComponentFixture<TutorialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TutorialsComponent],
      providers: [{provide: ActivatedRoute, useValue: {}}],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TutorialsComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorialsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('shortTime', () => {
    it('pads a single-digit hour and minute to HH:mm', () => {
      expect(component.shortTime('9:5')).toBe('09:05');
    });

    it('leaves an already-valid HH:mm time unchanged', () => {
      expect(component.shortTime('09:05')).toBe('09:05');
    });

    it('returns the raw string unchanged when it has no colon, instead of throwing', () => {
      expect(component.shortTime('9am')).toBe('9am');
    });

    it('returns an empty string for an empty input, instead of throwing', () => {
      expect(component.shortTime('')).toBe('');
    });

    it('returns an empty string for an undefined input, instead of throwing', () => {
      expect(component.shortTime(undefined)).toBe('');
    });

    it('never throws, for any malformed or missing input', () => {
      expect(() => component.shortTime('9am')).not.toThrow();
      expect(() => component.shortTime('')).not.toThrow();
      expect(() => component.shortTime(undefined)).not.toThrow();
    });
  });
});
