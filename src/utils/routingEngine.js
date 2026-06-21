/**
 * OmniFlow Routing Engine
 * Translates volatile deposit payouts into allocations across 4 money pools.
 */

function routeDeposit(amount, profile) {
  if (amount < 0) {
    throw new Error("Deposit amount cannot be negative");
  }
  
  const balances = profile.currentBalances || { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 };
  let remaining = amount;
  let reserveAlloc = 0;
  let taxAlloc = 0;
  let salaryAlloc = 0;
  let yieldAlloc = 0;

  // Custom splits support
  if (profile.customSplits) {
    taxAlloc = parseFloat((amount * (profile.customSplits.tax || 0)).toFixed(2));
    reserveAlloc = parseFloat((amount * (profile.customSplits.reserve || 0)).toFixed(2));
    salaryAlloc = parseFloat((amount * (profile.customSplits.salary || 0)).toFixed(2));
    yieldAlloc = parseFloat((amount * (profile.customSplits.yield || 0)).toFixed(2));
    return {
      tax_pool: taxAlloc,
      salary_buffer: salaryAlloc,
      reserve_floor: reserveAlloc,
      yield_pool: yieldAlloc
    };
  }

  // 1. Calculate tax reservation (calculated on the full incoming amount first)
  let taxRate = profile.taxBracket || 0;
  let desiredTax = amount * taxRate;

  // If progressive tax is enabled, calculate split
  if (profile.useProgressiveTax && profile.ytdIncome !== undefined) {
    let tax = 0;
    let remTax = amount;
    let current = profile.ytdIncome;
    
    const brackets = [
      { limit: 50000, rate: 0.10 },
      { limit: 100000, rate: 0.22 },
      { limit: 250000, rate: 0.24 },
      { limit: Infinity, rate: 0.32 }
    ];
    
    for (const b of brackets) {
      if (remTax <= 0) break;
      if (current < b.limit) {
        const chunkLimit = b.limit - current;
        const chunk = Math.min(remTax, chunkLimit);
        tax += chunk * b.rate;
        remTax -= chunk;
        current += chunk;
      }
    }
    desiredTax = tax;
  }

  taxAlloc = parseFloat(Math.min(remaining, desiredTax).toFixed(2));
  remaining = parseFloat((remaining - taxAlloc).toFixed(2));

  // 2. Shore up reserve floor first if below threshold
  const reserveFloorLimit = profile.reserveFloor || 0;
  if (balances.reserve_floor < reserveFloorLimit) {
    const needed = parseFloat((reserveFloorLimit - balances.reserve_floor).toFixed(2));
    reserveAlloc = parseFloat(Math.min(remaining, needed).toFixed(2));
    remaining = parseFloat((remaining - reserveAlloc).toFixed(2));
  }

  // 3. Allocate to salary buffer up to its limit (3 months of target paycheck = 6 * paycheck)
  const salaryLimit = 6 * (profile.targetPaycheck || 0);
  if (balances.salary_buffer < salaryLimit) {
    const needed = parseFloat((salaryLimit - balances.salary_buffer).toFixed(2));
    salaryAlloc = parseFloat(Math.min(remaining, needed).toFixed(2));
    remaining = parseFloat((remaining - salaryAlloc).toFixed(2));
  }

  // 4. Route remaining cash to yield pool
  yieldAlloc = parseFloat(Math.max(0, remaining).toFixed(2));

  return {
    tax_pool: taxAlloc,
    salary_buffer: salaryAlloc,
    reserve_floor: reserveAlloc,
    yield_pool: yieldAlloc
  };
}

export {
  routeDeposit
};
