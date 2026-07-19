import { BadRequestException } from '@nestjs/common';
import { assertValidTransition, TransitionMap } from './state-machine';

type Light = 'RED' | 'YELLOW' | 'GREEN';

const LIGHT_TRANSITIONS: TransitionMap<Light> = {
  RED: ['GREEN'],
  GREEN: ['YELLOW'],
  YELLOW: ['RED'],
};

describe('assertValidTransition', () => {
  it('allows a transition explicitly listed in the map', () => {
    expect(() => assertValidTransition('Light', LIGHT_TRANSITIONS, 'RED', 'GREEN')).not.toThrow();
  });

  it('rejects a transition not listed in the map (state jump)', () => {
    expect(() => assertValidTransition('Light', LIGHT_TRANSITIONS, 'RED', 'YELLOW')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a transition out of a terminal state', () => {
    const terminal: TransitionMap<Light> = { RED: [], GREEN: [], YELLOW: [] };
    expect(() => assertValidTransition('Light', terminal, 'RED', 'GREEN')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a same-state transition unless explicitly allowed (no implicit no-op)', () => {
    expect(() => assertValidTransition('Light', LIGHT_TRANSITIONS, 'RED', 'RED')).toThrow(
      BadRequestException,
    );
  });

  it('allows a same-state transition when the map explicitly lists it as legal', () => {
    const withSelfLoop: TransitionMap<Light> = { RED: ['RED', 'GREEN'], GREEN: [], YELLOW: [] };
    expect(() => assertValidTransition('Light', withSelfLoop, 'RED', 'RED')).not.toThrow();
  });

  it('includes the entity name and allowed states in the error message', () => {
    try {
      assertValidTransition('Light', LIGHT_TRANSITIONS, 'RED', 'YELLOW');
      fail('expected assertValidTransition to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const message = (error as BadRequestException).message;
      expect(message).toContain('Light');
      expect(message).toContain('RED -> YELLOW');
      expect(message).toContain('GREEN');
    }
  });
});
