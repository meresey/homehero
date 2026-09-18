export const HERO_LOGIN_DOMAIN = 'heroes.homehero.invalid';

export function normalizeHeroUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidHeroUsername(value: string) {
  return /^[a-z][a-z0-9_]{2,19}$/.test(normalizeHeroUsername(value));
}

export function heroLoginEmail(username: string) {
  return `${normalizeHeroUsername(username)}@${HERO_LOGIN_DOMAIN}`;
}

export function isValidHeroPin(value: string) {
  return /^\d{6}$/.test(value);
}
