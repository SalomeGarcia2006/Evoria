export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;

export const PASSWORD_REQUIREMENTS =
  'La contraseña debe tener entre 8 y 128 caracteres, una minúscula, una mayúscula, un número y un carácter especial.';

export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}
