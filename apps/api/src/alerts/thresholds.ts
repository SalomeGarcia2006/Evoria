/** Determina si una condición acaba de entrar en la zona de alerta. */
export function crossedThreshold(previous: boolean, current: boolean): boolean {
  return !previous && current;
}

/** Un presupuesto sin iniciar o sin monto asignado no tiene porcentaje utilizable. */
export function isBudgetNearLimit(
  assignedCop: number | null,
  spentCop: number,
  thresholdPercent: number,
): boolean {
  if (
    assignedCop === null ||
    !Number.isFinite(assignedCop) ||
    assignedCop <= 0 ||
    !Number.isFinite(spentCop) ||
    spentCop < 0 ||
    !Number.isFinite(thresholdPercent) ||
    thresholdPercent <= 0 ||
    thresholdPercent > 100
  ) {
    return false;
  }
  return (spentCop / assignedCop) * 100 >= thresholdPercent;
}

/** El umbral de inventario se expresa como porcentaje disponible del total. */
export function isInventoryLow(
  total: number,
  available: number,
  thresholdPercent: number,
): boolean {
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    !Number.isFinite(available) ||
    available < 0 ||
    available > total ||
    !Number.isFinite(thresholdPercent) ||
    thresholdPercent < 0 ||
    thresholdPercent > 100
  ) {
    return false;
  }
  return (available / total) * 100 <= thresholdPercent;
}
