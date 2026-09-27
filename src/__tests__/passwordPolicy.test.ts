import { isStrongPassword, passwordRequirements } from '../passwordPolicy';

describe('password policy', () => {
  test('accepts a password satisfying every requirement', () => {
    expect(isStrongPassword('Hero@2026')).toBe(true);
    expect(passwordRequirements('Hero@2026').every(requirement => requirement.met)).toBe(true);
  });

  test.each([
    ['too short', 'He@1'],
    ['no lowercase letter', 'HERO@2026'],
    ['no capital letter', 'hero@2026'],
    ['no number', 'Hero@Home'],
    ['no approved symbol', 'Hero2026'],
  ])('rejects a password with %s', (_reason, password) => {
    expect(isStrongPassword(password)).toBe(false);
  });
});
