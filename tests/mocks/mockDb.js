/**
 * Stateful Mock Database Helper for Singular E2E Testing
 * Holds balances, invoices, receipts, logs, profile settings, YTD income, and time state.
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const geminiMock = require('./geminiMock');

// --- Fallback implementations ---

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

function loadModule(srcRelativePath, fallbackModule) {
  const container = { current: fallbackModule };
  const absolutePath = path.resolve(__dirname, '../../', srcRelativePath);
  
  if (fs.existsSync(absolutePath)) {
    const fileUrl = pathToFileURL(absolutePath).href;
    import(fileUrl).then((mod) => {
      container.current = mod.default || mod;
    }).catch((err) => {
      console.warn(`Warning: Failed to import module at ${absolutePath}, using fallback. Error: ${err.message}`);
    });
  }

  return new Proxy({}, {
    get(target, prop) {
      const active = container.current;
      const val = active[prop];
      if (typeof val === 'function') {
        return val.bind(active);
      }
      return val;
    }
  });
}

const routingEngine = loadModule('src/utils/routingEngine.js', fallbackRoutingEngine);
const accountant = loadModule('src/ai/accountant.js', fallbackAccountant);
const taxAdvisor = loadModule('src/ai/taxAdvisor.js', fallbackTaxAdvisor);
const treasury = loadModule('src/ai/treasury.js', fallbackTreasury);
const invoiceSentinel = loadModule('src/ai/invoiceSentinel.js', fallbackInvoiceSentinel);

class MockDb {
  constructor() {
    this.resetDemoState();
  }

  reset() {
    this.resetDemoState();
  }

  resetDemoState() {
    this.queue = Promise.resolve();
    this.balances = {
      tax_pool: 0,
      salary_buffer: 0,
      reserve_floor: 0,
      yield_pool: 0
    };
    this.invoices = [];
    this.receipts = [];
    this.agent_logs = [];
    this.drafts = [];
    this.profile = {
      targetPaycheck: 3000,
      reserveFloor: 5000,
      taxBracket: 0.20,
      useProgressiveTax: false
    };
    this.ytdIncome = 0;
    this.currentDay = 0;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    this.agent_logs.push({ timestamp, level, message });
  }

  insertInvoice(invoice) {
    this.invoices.push(invoice);
  }

  updateInvoice(invoiceId, updates) {
    const index = this.invoices.findIndex(inv => inv.invoiceId === invoiceId);
    if (index !== -1) {
      this.invoices[index] = { ...this.invoices[index], ...updates };
    }
  }

  async simulateInvoicePaid(amount) {
    return this.queue = this.queue.then(async () => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        this.log("Rejected invalid payment amount payload", "WARNING");
        return;
      }
      if (amount < 0) {
        throw new Error("Deposit amount cannot be negative");
      }

      const startIncome = this.ytdIncome;
      const endIncome = startIncome + amount;

      // Check for tax bracket transition first
      const taxResult = await taxAdvisor.evaluateTaxBracket(endIncome, this.profile);
      const oldBracket = this.profile.taxBracket;
      const newBracket = taxResult.currentBracket;

      if (newBracket > oldBracket) {
        this.profile.taxBracket = newBracket;
      }

      // Apply allocations using the updated bracket rate
      const profileForRouting = {
        ...this.profile,
        ytdIncome: startIncome,
        currentBalances: { ...this.balances }
      };

      const allocations = routingEngine.routeDeposit(amount, profileForRouting);

      // Apply allocations to balances
      this.balances.tax_pool = parseFloat((this.balances.tax_pool + allocations.tax_pool).toFixed(2));
      this.balances.salary_buffer = parseFloat((this.balances.salary_buffer + allocations.salary_buffer).toFixed(2));
      this.balances.reserve_floor = parseFloat((this.balances.reserve_floor + allocations.reserve_floor).toFixed(2));
      this.balances.yield_pool = parseFloat((this.balances.yield_pool + allocations.yield_pool).toFixed(2));
      this.ytdIncome = endIncome;

      this.log(`Invoice paid: $${amount}. Routed: tax=$${allocations.tax_pool}, salary=$${allocations.salary_buffer}, reserve=$${allocations.reserve_floor}, yield=$${allocations.yield_pool}`);

      // If there was a bracket shift, shore up retroactively
      if (newBracket > oldBracket) {
        const retroAdjust = parseFloat((startIncome * (newBracket - oldBracket)).toFixed(2));
        if (retroAdjust > 0) {
          const pullAmount = Math.min(this.balances.yield_pool, retroAdjust);
          this.balances.yield_pool = parseFloat((this.balances.yield_pool - pullAmount).toFixed(2));
          this.balances.tax_pool = parseFloat((this.balances.tax_pool + retroAdjust).toFixed(2));
          this.log(`Tax bracket shifted to ${newBracket * 100}%. Retroactive tax shoring of $${retroAdjust} triggered. Pulled $${pullAmount} from yield pool.`);
        }
      }
    });
  }

  async simulateLargeMilestone(amount) {
    return this.queue = this.queue.then(async () => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        this.log("Rejected invalid milestone amount payload", "WARNING");
        return;
      }
      if (amount < 0) {
        throw new Error("Deposit amount cannot be negative");
      }

      const startIncome = this.ytdIncome;
      const endIncome = startIncome + amount;

      // Evaluate tax bracket shift first to apply the new rate flatly to the deposit
      const taxResult = await taxAdvisor.evaluateTaxBracket(endIncome, this.profile);
      const oldBracket = this.profile.taxBracket;
      const newBracket = taxResult.currentBracket;

      if (newBracket > oldBracket) {
        this.profile.taxBracket = newBracket;
      }

      // Route deposit with new tax bracket (which routes newBracket * amount to tax_pool)
      const profileForRouting = {
        ...this.profile,
        ytdIncome: startIncome,
        currentBalances: { ...this.balances }
      };
      const allocations = routingEngine.routeDeposit(amount, profileForRouting);

      this.balances.tax_pool = parseFloat((this.balances.tax_pool + allocations.tax_pool).toFixed(2));
      this.balances.salary_buffer = parseFloat((this.balances.salary_buffer + allocations.salary_buffer).toFixed(2));
      this.balances.reserve_floor = parseFloat((this.balances.reserve_floor + allocations.reserve_floor).toFixed(2));
      this.balances.yield_pool = parseFloat((this.balances.yield_pool + allocations.yield_pool).toFixed(2));
      this.ytdIncome = endIncome;

      this.log(`Large Milestone paid: $${amount}. Routed: tax=$${allocations.tax_pool}, salary=$${allocations.salary_buffer}, reserve=$${allocations.reserve_floor}, yield=$${allocations.yield_pool}`);

      // If there was a bracket shift, shore up retroactively
      if (newBracket > oldBracket) {
        const retroAdjust = parseFloat((startIncome * (newBracket - oldBracket)).toFixed(2));
        if (retroAdjust > 0) {
          // Shore up from yield pool or other available funds
          const pullAmount = Math.min(this.balances.yield_pool, retroAdjust);
          this.balances.yield_pool = parseFloat((this.balances.yield_pool - pullAmount).toFixed(2));
          this.balances.tax_pool = parseFloat((this.balances.tax_pool + retroAdjust).toFixed(2));
          this.log(`Tax bracket shifted to ${newBracket * 100}%. Retroactive tax shoring of $${retroAdjust} triggered. Pulled $${pullAmount} from yield pool.`);
        }
      }
    });
  }

  async simulateReceiptUpload(text) {
    return this.queue = this.queue.then(async () => {
      const auditResult = await accountant.auditReceipt(null, text);
      this.receipts.push(auditResult);

      if (auditResult.isEligibleWriteoff) {
        const taxRate = this.profile.taxBracket;
        const taxSavings = parseFloat((auditResult.amount * taxRate).toFixed(2));
        const releaseAmount = Math.min(this.balances.tax_pool, taxSavings);

        this.balances.tax_pool = parseFloat((this.balances.tax_pool - releaseAmount).toFixed(2));
        this.balances.salary_buffer = parseFloat((this.balances.salary_buffer + releaseAmount).toFixed(2));

        this.log(`Receipt upload audited: $${auditResult.amount} classified as ${auditResult.category}. Tax savings of $${taxSavings} released (actual: $${releaseAmount}).`);
      } else {
        this.log(`Receipt upload audited: $${auditResult.amount} classified as personal/ineligible.`);
      }

      return auditResult;
    });
  }

  async simulateClientCancellation() {
    const recallResult = await treasury.evaluateRunwayAndRecall(this.balances, this.profile.targetPaycheck);
    this.log(`WARNING: Client cancellation simulated. Runway is now ${recallResult.runwayMonths} months.`, 'WARNING');
  }

  async fastForward(days) {
    if (days < 0) {
      throw new Error("Fast-forward days cannot be negative");
    }
    for (let i = 1; i <= days; i++) {
      // Age invoices
      for (const inv of this.invoices) {
        if (inv.status === 'unpaid') {
          inv.overdueDays = (inv.overdueDays || 0) + 1;
        }
      }
      this.currentDay++;

      // Check paycheck dispatch (every 14 days)
      if (this.currentDay % 14 === 0) {
        const paycheck = this.profile.targetPaycheck;

        // Check if liquid cash is below paycheck amount -> trigger recall
        if (this.balances.salary_buffer < paycheck) {
          const recallResult = await treasury.evaluateRunwayAndRecall(this.balances, paycheck);
          if (recallResult.actionTaken && recallResult.recallAmount > 0) {
            const actualRecall = Math.min(this.balances.yield_pool, recallResult.recallAmount);
            this.balances.yield_pool = parseFloat((this.balances.yield_pool - actualRecall).toFixed(2));
            this.balances.salary_buffer = parseFloat((this.balances.salary_buffer + actualRecall).toFixed(2));
            this.log(`Yield recall triggered. Recalled $${actualRecall} to salary buffer.`);
          }
        }

        // Attempt paycheck dispatch
        if (this.balances.salary_buffer >= paycheck) {
          this.balances.salary_buffer = parseFloat((this.balances.salary_buffer - paycheck).toFixed(2));
          this.log(`Paycheck of $${paycheck} dispatched successfully.`);
        } else {
          // Partial payment case
          const partial = this.balances.salary_buffer;
          this.balances.salary_buffer = 0;
          this.log(`CRITICAL: Insufficient funds for paycheck! Dispatched partial payment of $${partial}.`, 'CRITICAL');
        }
      }
    }

    // Trigger check for overdue invoices at the end
    const overdueDrafts = await invoiceSentinel.checkOverdueInvoices(this.invoices);
    for (const draft of overdueDrafts) {
      this.drafts.push(draft);
      this.log(`Invoice Sentinel draft created for ${draft.client} (Invoice: ${draft.invoiceId}, tone: ${draft.overdueDays >= 21 ? 'urgent' : 'friendly'})`);
    }
  }
}

module.exports = new MockDb();
