export const MEMBERSHIP_STATUSES = ['activo', 'inactivo'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
