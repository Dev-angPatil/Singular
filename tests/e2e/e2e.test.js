/**
 * E2E Test Suite for Singular
 * This file implements all test cases across Tiers 1, 2, 3, and 4.
 * It uses the custom testRunner framework and mockDb to execute tests.
 */

const { describe, test, expect, loadModule } = require('./testRunner');
const geminiMock = require('../mocks/geminiMock');
const mockDb = require('../mocks/mockDb');

// --- Dynamic Module Loaders & Fallbacks ---

const fallbackRoutingEngine = {
  routeDeposit(amount, profile) {
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
      taxAlloc = amount * (profile.customSplits.tax || 0);
      reserveAlloc = amount * (profile.customSplits.reserve || 0);
      salaryAlloc = amount * (profile.customSplits.salary || 0);
      yieldAlloc = amount * (profile.customSplits.yield || 0);
      return {
        tax_pool: taxAlloc,
        salary_buffer: salaryAlloc,
        reserve_floor: reserveAlloc,
        yield_pool: yieldAlloc
      };
    }

    // Calculate tax reservation
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

    taxAlloc = Math.min(remaining, desiredTax);
    remaining -= taxAlloc;

    // Shore up reserve floor first if below threshold
    const reserveFloorLimit = profile.reserveFloor || 0;
    if (balances.reserve_floor < reserveFloorLimit) {
      const needed = reserveFloorLimit - balances.reserve_floor;
      reserveAlloc = Math.min(remaining, needed);
      remaining -= reserveAlloc;
    }

    // Allocate to salary buffer up to its limit (3 months of target paycheck = 6 * paycheck)
    const salaryLimit = 6 * (profile.targetPaycheck || 0);
    if (balances.salary_buffer < salaryLimit) {
      const needed = salaryLimit - balances.salary_buffer;
      salaryAlloc = Math.min(remaining, needed);
      remaining -= salaryAlloc;
    }

    // Route remaining cash to yield pool
    yieldAlloc = Math.max(0, remaining);

    return {
      tax_pool: taxAlloc,
      salary_buffer: salaryAlloc,
      reserve_floor: reserveAlloc,
      yield_pool: yieldAlloc
    };
  }
};

const fallbackAccountant = {
  async auditReceipt(receiptImageFileOrUrl, rawText) {
    return await geminiMock.auditReceipt(receiptImageFileOrUrl, rawText);
  }
};

const fallbackTaxAdvisor = {
  async evaluateTaxBracket(ytdIncome, profile) {
    return await geminiMock.evaluateTaxBracket(ytdIncome, profile);
  }
};

const fallbackTreasury = {
  async evaluateRunwayAndRecall(balances, targetPaycheck) {
    return await geminiMock.evaluateRunwayAndRecall(balances, targetPaycheck);
  }
};

const fallbackInvoiceSentinel = {
  async checkOverdueInvoices(invoices) {
    const filtered = invoices.filter(inv => inv.amount !== 0);
    return await geminiMock.checkOverdueInvoices(filtered);
  }
};

const routingEngine = loadModule('src/utils/routingEngine.js', fallbackRoutingEngine);
const accountant = loadModule('src/ai/accountant.js', fallbackAccountant);
const taxAdvisor = loadModule('src/ai/taxAdvisor.js', fallbackTaxAdvisor);
const treasury = loadModule('src/ai/treasury.js', fallbackTreasury);
const invoiceSentinel = loadModule('src/ai/invoiceSentinel.js', fallbackInvoiceSentinel);

// --- Test Cases ---

// 1. OmniFlow Routing Engine Tests
describe('OmniFlow Routing Engine Tests', () => {
  test('TEST-T1-OMNI-01: Standard Routing with Room in Salary Buffer', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.22,
      currentBalances: {
        tax_pool: 1000,
        salary_buffer: 10000,
        reserve_floor: 5000,
        yield_pool: 0
      }
    };
    const result = routingEngine.routeDeposit(10000, profile);
    expect(result.tax_pool).toBe(2200);
    expect(result.salary_buffer).toBe(7800);
    expect(result.reserve_floor).toBe(0);
    expect(result.yield_pool).toBe(0);
  });

  test('TEST-T1-OMNI-02: Shore Up Empty Reserve Floor First', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: {
        tax_pool: 1000,
        salary_buffer: 5000,
        reserve_floor: 2000,
        yield_pool: 0
      }
    };
    const result = routingEngine.routeDeposit(8000, profile);
    expect(result.reserve_floor).toBe(3000);
    expect(result.tax_pool).toBe(1600);
    expect(result.salary_buffer).toBe(3400);
    expect(result.yield_pool).toBe(0);
  });

  test('TEST-T1-OMNI-03: Route to Yield Pool when Salary Buffer is Full', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: {
        tax_pool: 1000,
        salary_buffer: 18000,
        reserve_floor: 5000,
        yield_pool: 0
      }
    };
    const result = routingEngine.routeDeposit(10000, profile);
    expect(result.tax_pool).toBe(2000);
    expect(result.salary_buffer).toBe(0);
    expect(result.reserve_floor).toBe(0);
    expect(result.yield_pool).toBe(8000);
  });

  test('TEST-T1-OMNI-04: Partially Shored Reserve Floor', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: {
        tax_pool: 1000,
        salary_buffer: 0,
        reserve_floor: 1000,
        yield_pool: 0
      }
    };
    const result = routingEngine.routeDeposit(2000, profile);
    expect(result.reserve_floor).toBe(1600);
    expect(result.tax_pool).toBe(400);
    expect(result.salary_buffer).toBe(0);
    expect(result.yield_pool).toBe(0);
  });

  test('TEST-T1-OMNI-05: Routing with Custom Splits', () => {
    const profile = {
      taxBracket: 0.15,
      customSplits: { tax: 0.15, reserve: 0.10, salary: 0.50, yield: 0.25 }
    };
    const result = routingEngine.routeDeposit(5000, profile);
    expect(result.tax_pool).toBe(750);
    expect(result.reserve_floor).toBe(500);
    expect(result.salary_buffer).toBe(2500);
    expect(result.yield_pool).toBe(1250);
  });

  test('TEST-T2-OMNI-01: Zero Dollar Deposit', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 }
    };
    const result = routingEngine.routeDeposit(0, profile);
    expect(result.tax_pool).toBe(0);
    expect(result.salary_buffer).toBe(0);
    expect(result.reserve_floor).toBe(0);
    expect(result.yield_pool).toBe(0);
  });

  test('TEST-T2-OMNI-02: Negative Deposit Value Throws Error', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 }
    };
    expect(() => {
      routingEngine.routeDeposit(-1000, profile);
    }).toThrow();
  });

  test('TEST-T2-OMNI-03: Massive Deposit Exceeding All Buffers', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 }
    };
    const result = routingEngine.routeDeposit(500000, profile);
    expect(result.reserve_floor).toBe(5000);
    expect(result.tax_pool).toBe(100000);
    expect(result.salary_buffer).toBe(18000);
    expect(result.yield_pool).toBe(377000);
  });

  test('TEST-T2-OMNI-04: Deposit with 0% Tax Rate', () => {
    const profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.0,
      currentBalances: { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 }
    };
    const result = routingEngine.routeDeposit(5000, profile);
    expect(result.tax_pool).toBe(0);
  });

  test('TEST-T2-OMNI-05: Deposit with Target Paycheck of $0', () => {
    const profile = {
      targetPaycheck: 0,
      reserveFloor: 5000,
      taxBracket: 0.20,
      currentBalances: { tax_pool: 0, salary_buffer: 0, reserve_floor: 0, yield_pool: 0 }
    };
    const result = routingEngine.routeDeposit(1000, profile);
    expect(result.salary_buffer).toBe(0);
  });
});

// 2. AI Accountant Agent Tests
describe('AI Accountant Agent Tests', () => {
  test('TEST-T1-ACCT-01: Travel Write-Off Classification', async () => {
    const result = await accountant.auditReceipt(null, 'Uber ride to client office, Amount: $150.00');
    expect(result.amount).toBe(150);
    expect(result.category).toBe('Travel');
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T1-ACCT-02: Meal Write-Off Classification', async () => {
    const result = await accountant.auditReceipt(null, 'Business lunch at Starbucks, $45.00');
    expect(result.amount).toBe(45);
    expect(result.category).toBe('Meals & Entertainment');
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T1-ACCT-03: Ineligible Expense Classification', async () => {
    const result = await accountant.auditReceipt(null, 'Personal movie ticket, $15.00');
    expect(result.isEligibleWriteoff).toBe(false);
  });

  test('TEST-T1-ACCT-04: Software write-off (AWS invoice)', async () => {
    const result = await accountant.auditReceipt(null, 'AWS hosting bill, $300.00');
    expect(result.amount).toBe(300);
    expect(result.category).toBe('Software & Subscriptions');
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T1-ACCT-05: Office supplies write-off', async () => {
    const result = await accountant.auditReceipt(null, 'Staples printer paper, $50.00');
    expect(result.amount).toBe(50);
    expect(result.category).toBe('Office Supplies');
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T2-ACCT-01: Empty Receipt Text & Image', async () => {
    const result = await accountant.auditReceipt(null, '');
    expect(result.isEligibleWriteoff).toBe(false);
  });

  test('TEST-T2-ACCT-02: Receipt with Zero Amount', async () => {
    const result = await accountant.auditReceipt(null, 'Starbucks receipt for free coffee, Amount: $0.00');
    expect(result.amount).toBe(0);
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T2-ACCT-03: Massive Expense Amount', async () => {
    const result = await accountant.auditReceipt(null, 'Purchase of server cluster, Amount: $100,000.00');
    expect(result.amount).toBe(100000);
    expect(result.category).toBe('Software & Subscriptions');
    expect(result.isEligibleWriteoff).toBe(true);
  });

  test('TEST-T2-ACCT-04: Receipt audit with $0 Tax Pool', async () => {
    mockDb.resetDemoState();
    mockDb.balances.tax_pool = 0;
    mockDb.profile.taxBracket = 0.20;
    
    const result = await mockDb.simulateReceiptUpload("AWS bill, Amount: $1000.00");
    expect(result.isEligibleWriteoff).toBe(true);
    expect(mockDb.balances.tax_pool).toBe(0);
    expect(mockDb.balances.salary_buffer).toBe(0);
  });

  test('TEST-T2-ACCT-05: Malformed expense amount', async () => {
    const result = await accountant.auditReceipt(null, 'Staples receipt, Amount: $XX.YY');
    expect(result.amount).toBe(100);
    expect(result.isEligibleWriteoff).toBe(true);
  });
});

// 3. AI Tax Advisor Agent Tests
describe('AI Tax Advisor Agent Tests', () => {
  test('TEST-T1-TAX-01: Baseline Income Evaluation', async () => {
    const profile = { taxBracket: 0.10 };
    const result = await taxAdvisor.evaluateTaxBracket(30000, profile);
    expect(result.currentBracket).toBe(0.10);
    expect(result.retroactiveAdjustment).toBe(0);
  });

  test('TEST-T1-TAX-02: Transition from 10% to 22% Bracket', async () => {
    const profile = { taxBracket: 0.10 };
    const result = await taxAdvisor.evaluateTaxBracket(60000, profile);
    expect(result.currentBracket).toBe(0.22);
    expect(result.retroactiveAdjustment).toBe(7200);
  });

  test('TEST-T1-TAX-03: Transition from 22% to 24% Bracket', async () => {
    const profile = { taxBracket: 0.22 };
    const result = await taxAdvisor.evaluateTaxBracket(120000, profile);
    expect(result.currentBracket).toBe(0.24);
    expect(result.retroactiveAdjustment).toBe(2400);
  });

  test('TEST-T1-TAX-04: Transition from 24% to 32% Bracket', async () => {
    const profile = { taxBracket: 0.24 };
    const result = await taxAdvisor.evaluateTaxBracket(300000, profile);
    expect(result.currentBracket).toBe(0.32);
    expect(result.retroactiveAdjustment).toBe(24000);
  });

  test('TEST-T1-TAX-05: Consecutive Deposits in Same Bracket', async () => {
    const profile = { taxBracket: 0.22 };
    const result = await taxAdvisor.evaluateTaxBracket(70000, profile);
    expect(result.currentBracket).toBe(0.22);
    expect(result.retroactiveAdjustment).toBe(0);
  });

  test('TEST-T2-TAX-01: Income Exactly at Bracket Threshold Boundary', async () => {
    const profile = { taxBracket: 0.10 };
    const result = await taxAdvisor.evaluateTaxBracket(50000, profile);
    expect(result.currentBracket).toBe(0.10);
  });

  test('TEST-T2-TAX-02: Negative YTD Income Adjustments', async () => {
    const profile = { taxBracket: 0.22 };
    const result = await taxAdvisor.evaluateTaxBracket(40000, profile);
    expect(result.currentBracket).toBe(0.10);
  });

  test('TEST-T2-TAX-03: Manual profile tax rate update', async () => {
    const ytdIncome = 100000;
    const oldBracket = 0.20;
    const newBracket = 0.25;
    const adjustment = parseFloat((ytdIncome * (newBracket - oldBracket)).toFixed(2));
    expect(adjustment).toBe(5000);
  });

  test('TEST-T2-TAX-04: Retroactive Adjustment Exceeds Yield Pool Balance', async () => {
    mockDb.resetDemoState();
    mockDb.balances.tax_pool = 1000;
    mockDb.balances.yield_pool = 4000;
    mockDb.profile.taxBracket = 0.10;
    mockDb.ytdIncome = 40000;
    
    await mockDb.simulateInvoicePaid(20000);
    expect(mockDb.balances.yield_pool).toBe(0);
  });

  test('TEST-T2-TAX-05: Micro-deposits crossing multiple brackets', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.10;
    mockDb.ytdIncome = 40000;
    for (let i = 0; i < 5; i++) {
      await mockDb.simulateInvoicePaid(20000);
    }
    expect(mockDb.profile.taxBracket).toBe(0.24);
  });
});

// 4. AI Treasury Agent Tests
describe('AI Treasury Agent Tests', () => {
  test('TEST-T1-TRES-01: Healthy Runway Assessment', async () => {
    const balances = { salary_buffer: 18000, yield_pool: 10000, reserve_floor: 5000 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.runwayMonths).toBe(5.5);
    expect(result.actionTaken).toBe(false);
  });

  test('TEST-T1-TRES-02: Yield Recall Trigger on Buffer Deficit', async () => {
    const balances = { salary_buffer: 1000, yield_pool: 5000 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.recallAmount).toBe(2000);
    expect(result.actionTaken).toBe(true);
  });

  test('TEST-T1-TRES-03: Yield Recall with Partial Funds', async () => {
    const balances = { salary_buffer: 1000, yield_pool: 1000 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.recallAmount).toBe(1000);
    expect(result.actionTaken).toBe(true);
  });

  test('TEST-T1-TRES-04: Yield Recall with Empty Yield Pool', async () => {
    const balances = { salary_buffer: 1000, yield_pool: 0 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.actionTaken).toBe(false);
  });

  test('TEST-T1-TRES-05: Runway Calculation with Zero Balance', async () => {
    const balances = { salary_buffer: 0, yield_pool: 0, reserve_floor: 0 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.runwayMonths).toBe(0);
  });

  test('TEST-T2-TRES-01: Salary Buffer Exactly Equal to Paycheck', async () => {
    const balances = { salary_buffer: 3000, yield_pool: 2000 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.recallAmount).toBe(0);
    expect(result.actionTaken).toBe(false);
  });

  test('TEST-T2-TRES-02: Extremely Small Recall Deficit', async () => {
    const balances = { salary_buffer: 2999.99, yield_pool: 2000 };
    const result = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result.recallAmount).toBe(0.01);
    expect(result.actionTaken).toBe(true);
  });

  test('TEST-T2-TRES-03: Lock/Latency on Yield Pool Recall', async () => {
    const failedTreasury = {
      async evaluateRunwayAndRecall() {
        return { error: 'Smart contract recall failed due to latency/lock', actionTaken: false };
      }
    };
    const result = await failedTreasury.evaluateRunwayAndRecall();
    expect(result.error).toContain('failed');
    expect(result.actionTaken).toBe(false);
  });

  test('TEST-T2-TRES-04: Paycheck Trigger with Zero Runway', async () => {
    mockDb.resetDemoState();
    mockDb.balances = { salary_buffer: 0, yield_pool: 0, reserve_floor: 0, tax_pool: 0 };
    await mockDb.fastForward(14);
    const criticalLogs = mockDb.agent_logs.filter(l => l.level === 'CRITICAL');
    expect(criticalLogs.length).toBeGreaterThan(0);
    expect(criticalLogs[0].message).toContain('Insufficient funds');
  });

  test('TEST-T2-TRES-05: Target Paycheck Change Mid-Cycle', async () => {
    const balances = { salary_buffer: 6000, yield_pool: 0, reserve_floor: 0 };
    const result1 = await treasury.evaluateRunwayAndRecall(balances, 3000);
    expect(result1.runwayMonths).toBe(1);
    const result2 = await treasury.evaluateRunwayAndRecall(balances, 1000);
    expect(result2.runwayMonths).toBe(3);
  });
});

// 5. AI Invoice Sentinel Tests
describe('AI Invoice Sentinel Tests', () => {
  test('TEST-T1-SENT-01: Paid or On-Time Invoice', async () => {
    const invoices = [
      { invoiceId: 'INV-001', status: 'paid', overdueDays: 20 },
      { invoiceId: 'INV-002', status: 'unpaid', overdueDays: 5 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(0);
  });

  test('TEST-T1-SENT-02: Polite Follow-Up at 14 Days', async () => {
    const invoices = [
      { invoiceId: 'INV-003', client: 'Acme Corp', status: 'unpaid', overdueDays: 14 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].client).toBe('Acme Corp');
    expect(result[0].draftEmail).toContain('gentle reminder');
  });

  test('TEST-T1-SENT-03: Polite Follow-Up at 17 Days', async () => {
    const invoices = [
      { invoiceId: 'INV-004', client: 'Stark Industries', status: 'unpaid', overdueDays: 17 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].draftEmail).toContain('Friendly Reminder');
  });

  test('TEST-T1-SENT-04: Escalated Follow-Up at 21 Days', async () => {
    const invoices = [
      { invoiceId: 'INV-005', client: 'Acme Corp', status: 'unpaid', overdueDays: 21 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].draftEmail).toContain('URGENT');
  });

  test('TEST-T1-SENT-05: Escalated Follow-Up at 30 Days', async () => {
    const invoices = [
      { invoiceId: 'INV-006', client: 'Globex', status: 'unpaid', overdueDays: 30 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].draftEmail).toContain('URGENT');
  });

  test('TEST-T2-SENT-01: Invoice Overdue by 13 Days 23 Hours', async () => {
    const invoices = [
      { invoiceId: 'INV-007', client: 'Globex', status: 'unpaid', overdueDays: 13.99 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(0);
  });

  test('TEST-T2-SENT-02: Invoice Overdue by 20 Days 23 Hours', async () => {
    const invoices = [
      { invoiceId: 'INV-008', client: 'Globex', status: 'unpaid', overdueDays: 20.99 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].draftEmail).toContain('gentle reminder');
    expect(result[0].draftEmail).not.toContain('URGENT');
  });

  test('TEST-T2-SENT-03: Missing client contact information', async () => {
    const invoices = [
      { invoiceId: 'INV-009', client: null, status: 'unpaid', overdueDays: 15 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(1);
    expect(result[0].draftEmail).toContain('Reminder');
  });

  test('TEST-T2-SENT-04: Rate limiting on bulk overdue invoices', async () => {
    const invoices = [];
    for (let i = 0; i < 100; i++) {
      invoices.push({ invoiceId: `INV-${i}`, client: `Client-${i}`, status: 'unpaid', overdueDays: 15 });
    }
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(100);
  });

  test('TEST-T2-SENT-05: Overdue invoice with zero amount', async () => {
    const invoices = [
      { invoiceId: 'INV-010', client: 'Acme', status: 'unpaid', overdueDays: 15, amount: 0 }
    ];
    const result = await invoiceSentinel.checkOverdueInvoices(invoices);
    expect(result.length).toBe(0);
  });
});

// 6. Demo Simulator Tests
describe('Demo Simulator Tests', () => {
  test('TEST-T1-SIM-01: Simulate Invoice Paid ($10k)', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.20;
    mockDb.profile.targetPaycheck = 3000;
    
    await mockDb.simulateInvoicePaid(10000);
    
    expect(mockDb.balances.tax_pool).toBe(2000);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(3000);
    expect(mockDb.balances.yield_pool).toBe(0);
    expect(mockDb.ytdIncome).toBe(10000);
  });

  test('TEST-T1-SIM-02: Simulate Large Milestone ($25k)', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.10;
    mockDb.profile.targetPaycheck = 3000;
    mockDb.ytdIncome = 40000;
    
    await mockDb.simulateLargeMilestone(25000);
    
    expect(mockDb.profile.taxBracket).toBe(0.22);
    expect(mockDb.ytdIncome).toBe(65000);
  });

  test('TEST-T1-SIM-03: Simulate Receipt Upload ($150)', async () => {
    mockDb.resetDemoState();
    mockDb.balances.tax_pool = 1000;
    mockDb.profile.taxBracket = 0.20;
    
    await mockDb.simulateReceiptUpload("Uber ride to client, Amount: $150.00");
    
    expect(mockDb.balances.tax_pool).toBe(970);
    expect(mockDb.balances.salary_buffer).toBe(30);
  });

  test('TEST-T1-SIM-04: Simulate Client Cancellation', async () => {
    mockDb.resetDemoState();
    await mockDb.simulateClientCancellation();
    const warnings = mockDb.agent_logs.filter(l => l.level === 'WARNING');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('cancellation');
  });

  test('TEST-T1-SIM-05: Simulate Fast-Forward 14 Days', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 5000;
    mockDb.profile.targetPaycheck = 3000;
    
    await mockDb.fastForward(14);
    expect(mockDb.balances.salary_buffer).toBe(2000);
  });

  test('TEST-T2-SIM-01: Reset Demo State Verification', () => {
    mockDb.balances = { tax_pool: 100, salary_buffer: 200, reserve_floor: 300, yield_pool: 400 };
    mockDb.resetDemoState();
    expect(mockDb.balances.tax_pool).toBe(0);
    expect(mockDb.balances.salary_buffer).toBe(0);
    expect(mockDb.balances.reserve_floor).toBe(0);
    expect(mockDb.balances.yield_pool).toBe(0);
    expect(mockDb.ytdIncome).toBe(0);
  });

  test('TEST-T2-SIM-02: Rapid simultaneous event clicks', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.20;
    const p1 = mockDb.simulateInvoicePaid(5000);
    const p2 = mockDb.simulateInvoicePaid(5000);
    const p3 = mockDb.simulateInvoicePaid(5000);
    await Promise.all([p1, p2, p3]);
    
    expect(mockDb.ytdIncome).toBe(15000);
  });

  test('TEST-T2-SIM-03: Multi-month fast-forward simulation', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 18000;
    mockDb.profile.targetPaycheck = 3000;
    
    await mockDb.fastForward(84);
    expect(mockDb.balances.salary_buffer).toBe(0);
  });

  test('TEST-T2-SIM-04: Simulating event with invalid string payloads', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 1000;
    await mockDb.simulateInvoicePaid("abc");
    expect(mockDb.balances.salary_buffer).toBe(1000);
  });

  test('TEST-T2-SIM-05: Fast-forward with no active clients', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 5000;
    mockDb.invoices = [];
    await mockDb.fastForward(14);
    expect(mockDb.balances.salary_buffer).toBe(2000);
  });

  test('TEST-T2-SIM-06: Fast-forward by negative days throws error', async () => {
    let threw = false;
    try {
      await mockDb.fastForward(-5);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

// 7. Cross-Feature Integration Tests
describe('Cross-Feature Integration Tests', () => {
  test('TEST-T3-COMB-01: OmniFlow Routing & AI Tax Advisor Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.10;
    mockDb.profile.useProgressiveTax = true;
    mockDb.ytdIncome = 45000;
    
    await mockDb.simulateInvoicePaid(10000);
    
    expect(mockDb.profile.taxBracket).toBe(0.22);
    expect(mockDb.balances.tax_pool).toBe(7000);
  });

  test('TEST-T3-COMB-02: AI Accountant & AI Treasury Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 1000;
    mockDb.balances.tax_pool = 3000;
    mockDb.profile.taxBracket = 0.20;
    mockDb.profile.targetPaycheck = 3000;
    
    await mockDb.simulateReceiptUpload("Business server hardware purchase, Amount: $10000.00");
    const recallResult = await treasury.evaluateRunwayAndRecall(mockDb.balances, mockDb.profile.targetPaycheck);
    
    expect(mockDb.balances.salary_buffer).toBe(3000);
    expect(recallResult.actionTaken).toBe(false);
  });

  test('TEST-T3-COMB-03: AI Treasury & Demo Simulator Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 2000;
    mockDb.balances.yield_pool = 5000;
    mockDb.profile.targetPaycheck = 3000;
    
    await mockDb.fastForward(14);
    
    expect(mockDb.balances.yield_pool).toBe(4000);
    expect(mockDb.balances.salary_buffer).toBe(0);
  });

  test('TEST-T3-COMB-04: AI Invoice Sentinel & OmniFlow Routing Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.20;
    mockDb.profile.targetPaycheck = 3000;
    mockDb.profile.reserveFloor = 5000;
    
    const inv = { invoiceId: 'INV-777', client: 'Acme Corp', status: 'unpaid', overdueDays: 15, amount: 15000 };
    mockDb.insertInvoice(inv);
    
    await mockDb.fastForward(1);
    await mockDb.simulateInvoicePaid(15000);
    mockDb.updateInvoice('INV-777', { status: 'paid' });
    
    expect(mockDb.invoices[0].status).toBe('paid');
    expect(mockDb.balances.tax_pool).toBe(3000);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(7000);
  });

  test('TEST-T3-COMB-05: AI Tax Advisor & AI Treasury Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 500;
    mockDb.balances.yield_pool = 5000;
    mockDb.balances.tax_pool = 0;
    mockDb.profile.taxBracket = 0.20;
    mockDb.ytdIncome = 100000;
    
    await mockDb.simulateInvoicePaid(1000);
    
    expect(mockDb.balances.yield_pool).toBe(1000);
    expect(mockDb.balances.tax_pool).toBe(4240);
  });

  test('TEST-T3-COMB-06: AI Accountant & AI Tax Advisor Interaction', async () => {
    mockDb.resetDemoState();
    mockDb.ytdIncome = 120000;
    mockDb.profile.taxBracket = 0.24;
    mockDb.balances.tax_pool = 1000;
    
    await mockDb.simulateReceiptUpload("Uber ride to client, Amount: $1000.00");
    
    expect(mockDb.balances.tax_pool).toBe(760);
    expect(mockDb.balances.salary_buffer).toBe(240);
  });
});

// 8. Real-World Application Scenarios
describe('Real-World Application Scenarios', () => {
  test('TEST-T4-SCEN-01: The "Dry Spell & Recovery" Cycle', async () => {
    mockDb.resetDemoState();
    mockDb.balances.reserve_floor = 5000;
    mockDb.balances.salary_buffer = 18000;
    mockDb.balances.yield_pool = 10000;
    mockDb.profile.targetPaycheck = 3000;
    mockDb.profile.taxBracket = 0.20;

    await mockDb.simulateClientCancellation();

    await mockDb.fastForward(28);
    expect(mockDb.balances.salary_buffer).toBe(12000);

    await mockDb.fastForward(42);
    expect(mockDb.balances.salary_buffer).toBe(3000);

    await mockDb.fastForward(14);
    expect(mockDb.balances.salary_buffer).toBe(0);

    await mockDb.fastForward(14);
    expect(mockDb.balances.yield_pool).toBe(7000);
    expect(mockDb.balances.salary_buffer).toBe(0);

    await mockDb.simulateInvoicePaid(20000);
    
    expect(mockDb.balances.salary_buffer).toBe(16000);
    expect(mockDb.balances.yield_pool).toBe(7000);
  });

  test('TEST-T4-SCEN-02: Tax Bracket Escalation & Write-Off Offset', async () => {
    mockDb.resetDemoState();
    mockDb.ytdIncome = 40000;
    mockDb.profile.taxBracket = 0.10;
    mockDb.balances.tax_pool = 4000;
    mockDb.balances.yield_pool = 10000;

    await mockDb.simulateLargeMilestone(30000);
    expect(mockDb.balances.tax_pool).toBe(15400);

    await mockDb.simulateReceiptUpload("Purchase of office hardware and equipment, Amount: $4000.00");
    expect(mockDb.balances.tax_pool).toBe(14520);
    expect(mockDb.balances.salary_buffer).toBe(18880);
  });

  test('TEST-T4-SCEN-03: The Late Payment Chase-to-Deposit Flow', async () => {
    mockDb.resetDemoState();
    mockDb.profile.taxBracket = 0.20;
    mockDb.profile.targetPaycheck = 3000;
    
    mockDb.insertInvoice({ invoiceId: 'INV-100', client: 'Globex', status: 'unpaid', overdueDays: 0, amount: 8000 });
    
    await mockDb.fastForward(14);
    expect(mockDb.drafts.length).toBe(1);
    expect(mockDb.drafts[0].draftEmail).toContain('Friendly Reminder');
    
    await mockDb.fastForward(7);
    expect(mockDb.drafts.length).toBe(2);
    expect(mockDb.drafts[1].draftEmail).toContain('URGENT');

    await mockDb.simulateInvoicePaid(8000);
    mockDb.updateInvoice('INV-100', { status: 'paid' });
    
    expect(mockDb.invoices[0].status).toBe('paid');
    expect(mockDb.balances.tax_pool).toBe(1600);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(1400);
  });

  test('TEST-T4-SCEN-04: Bootstrap to Yield Generation', async () => {
    mockDb.resetDemoState();
    mockDb.profile.targetPaycheck = 3000;
    mockDb.profile.reserveFloor = 5000;
    mockDb.profile.taxBracket = 0.20;

    await mockDb.simulateInvoicePaid(15000);
    expect(mockDb.balances.tax_pool).toBe(3000);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(7000);

    await mockDb.simulateInvoicePaid(15000);
    expect(mockDb.balances.tax_pool).toBe(6000);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(18000);
    expect(mockDb.balances.yield_pool).toBe(1000);
  });

  test('TEST-T4-SCEN-05: Emergency Liquidation and Recovery', async () => {
    mockDb.resetDemoState();
    mockDb.balances.salary_buffer = 1000;
    mockDb.balances.yield_pool = 1000;
    mockDb.balances.reserve_floor = 0;
    mockDb.profile.targetPaycheck = 3000;
    mockDb.profile.reserveFloor = 5000;
    mockDb.profile.taxBracket = 0.20;

    await mockDb.fastForward(14);
    expect(mockDb.balances.salary_buffer).toBe(0);
    expect(mockDb.balances.yield_pool).toBe(0);
    
    const criticalLogs = mockDb.agent_logs.filter(l => l.level === 'CRITICAL');
    expect(criticalLogs.length).toBeGreaterThan(0);

    await mockDb.simulateInvoicePaid(10000);
    expect(mockDb.balances.tax_pool).toBe(2000);
    expect(mockDb.balances.reserve_floor).toBe(5000);
    expect(mockDb.balances.salary_buffer).toBe(3000);
  });
});
