const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function validateNit(
  value: string,
): { valid: true; normalized: string } | { valid: false; message: string } {
  const input = value.trim();
  if (!input)
    return {
      valid: false,
      message: 'Ingresa el NIT y su dígito de verificación.',
    };

  const match = /^(\d{1,15}|\d{1,3}(?:\.\d{3}){1,4})-(\d)$/.exec(input);
  if (!match)
    return {
      valid: false,
      message:
        'Escribe el NIT seguido de un guion y su dígito de verificación, tal como aparece en el RUT.',
    };

  const number = match[1].replaceAll('.', '');
  if (number.length > weights.length || /^0+$/.test(number))
    return { valid: false, message: 'Ingresa un número de NIT válido.' };
  const sum = [...number]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  if (Number(match[2]) !== expected)
    return {
      valid: false,
      message:
        'El dígito de verificación no corresponde al NIT. Revisa los datos en el RUT.',
    };
  return { valid: true, normalized: `${number}-${match[2]}` };
}
