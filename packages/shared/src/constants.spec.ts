import { PLATFORM_NAME } from './constants';

describe('constants', () => {
  it('exposes a non-empty platform name', () => {
    expect(PLATFORM_NAME.length).toBeGreaterThan(0);
  });
});
