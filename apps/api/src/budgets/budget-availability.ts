export function hasAvailableBudget(amountCop: number) {
  return {
    $gte: [
      {
        $subtract: [
          { $add: ['$baseAmountCop', '$approvedIncreaseCop'] },
          {
            $add: ['$inventorySpentCop', '$providerSpentCop', '$extraSpentCop'],
          },
        ],
      },
      amountCop,
    ],
  };
}
