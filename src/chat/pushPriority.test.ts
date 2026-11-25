import { describe, expect, it } from '@jest/globals';
import { eventNotifies } from './pushPriority';

describe('eventNotifies', () => {
  it('garde la priorité haute pour ce qui fait une notification', () => {
    expect(eventNotifies({ action: 'thought' })).toBe(true);
    expect(eventNotifies({ action: 'mood' })).toBe(true);
    expect(eventNotifies({ action: 'relay-text' })).toBe(true);
    expect(eventNotifies({ action: 'react', emoji: '❤️' })).toBe(true);
  });

  it('passe en priorité normale ce qui ne montre rien', () => {
    expect(eventNotifies({ action: 'read-upto' })).toBe(false);
    expect(eventNotifies({ action: 'edit' })).toBe(false);
    expect(eventNotifies({ action: 'delete' })).toBe(false);
    expect(eventNotifies({ action: 'profile' })).toBe(false);
    expect(eventNotifies({ action: 'dates' })).toBe(false);
    expect(eventNotifies({ action: 'react', emoji: null })).toBe(false);
    expect(eventNotifies({})).toBe(false);
  });
});
