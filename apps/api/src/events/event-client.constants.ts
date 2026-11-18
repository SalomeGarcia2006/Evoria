export const EVENT_CLIENT_LIMITS = {
  name: { min: 2, max: 160 },
  identification: { min: 3, max: 50 },
  phone: { min: 7, max: 30 },
  address: { min: 3, max: 255 },
  email: { max: 254 },
} as const;

// International or local numbers, with 7–15 digits and common separators.
// No country or identification document type is assumed.
export const EVENT_CLIENT_PHONE_PATTERN =
  /^\+?(?=(?:\D*\d){7,15}\D*$)[\d ().-]+$/;
