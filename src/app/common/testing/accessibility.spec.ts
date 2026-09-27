import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {expectAccessible} from './accessibility';

describe('expectAccessible', () => {
  let fixture: HTMLElement;

  beforeEach(() => {
    fixture = document.createElement('main');
    document.body.append(fixture);
  });

  afterEach(() => fixture.remove());

  it('accepts a named button in the rendered fixture', async () => {
    fixture.innerHTML = '<button type="button" aria-label="Save changes"></button>';
    const result = await expectAccessible(fixture);
    expect(result.violations).toEqual([]);
    expect(result.passes.some((rule) => rule.id === 'button-name')).toBe(true);
  });

  it('fails the check for a deliberately unnamed button', async () => {
    fixture.innerHTML = '<button id="unnamed-action" type="button"></button>';
    await expect(expectAccessible(fixture)).rejects.toThrow(
      /button-name \((serious|critical)\)[\s\S]*unnamed-action/,
    );
  });

  it('does not keep a failed fixture in a baseline after the defect is fixed', async () => {
    fixture.innerHTML = '<button type="button"></button>';
    await expect(expectAccessible(fixture)).rejects.toThrow('button-name');
    fixture.querySelector('button').setAttribute('aria-label', 'Save changes');
    await expect(expectAccessible(fixture)).resolves.toMatchObject({violations: []});
  });

  it('keeps native label association checks enabled', async () => {
    fixture.innerHTML = '<input id="staff-name" type="text" />';
    await expect(expectAccessible(fixture)).rejects.toThrow(/label \((serious|critical)\)/);
    fixture.insertAdjacentHTML('afterbegin', '<label for="staff-name">Staff name</label>');
    await expect(expectAccessible(fixture)).resolves.toMatchObject({violations: []});
  });

  it('rejects detached fixtures instead of reporting an empty scan as a pass', async () => {
    fixture.remove();
    await expect(expectAccessible(fixture)).rejects.toThrow('attached to the document');
  });
});
