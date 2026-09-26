export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*._-';

export type PasswordRequirement = {
  id: 'length' | 'lowercase' | 'uppercase' | 'number' | 'special';
  label: string;
  met: boolean;
};

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'uppercase', label: 'One capital letter', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'One number', met: /[0-9]/.test(password) },
    { id: 'special', label: `One symbol (${PASSWORD_SPECIAL_CHARACTERS})`, met: [...password].some(character => PASSWORD_SPECIAL_CHARACTERS.includes(character)) },
  ];
}

export function isStrongPassword(password: string) {
  return passwordRequirements(password).every(requirement => requirement.met);
}
