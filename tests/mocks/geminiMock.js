/**
 * Gemini API Mock Client
 * Implements deterministic mock responses based on input keywords,
 * matching the interface contracts in PROJECT.md.
 */

/**
 * Audits a receipt image or text to classify it as a write-off.
 * @param {string|object} receiptImageFileOrUrl 
 * @param {string} rawText 
 * @returns {Promise<{amount: number, category: string, isEligibleWriteoff: boolean, explanation: string}>}
 */
async function auditReceipt(receiptImageFileOrUrl, rawText) {
  const text = (rawText || '').trim().toLowerCase();
  if (!text) {
    return {
      amount: 0,
      category: 'Office Supplies',
      isEligibleWriteoff: false,
      explanation: 'No receipt text provided.'
    };
  }

  let amount = 100.00; // Default fallback

  // Extract numeric amounts from text if possible, ignoring commas
  const cleanText = text.replace(/,/g, '');
  const amountMatch = cleanText.match(/(?:amount[:\s]*)?\$?([0-9]+(?:\.[0-9]{2})?)/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  let category = 'Office Supplies';
  let isEligibleWriteoff = true;
  let explanation = 'Valid business expense for daily operations.';

  if (text.includes('uber') || text.includes('taxi') || text.includes('lyft') || text.includes('flight') || text.includes('travel')) {
    category = 'Travel';
    explanation = 'Business-related travel to client location.';
  } else if (text.includes('coffee') || text.includes('starbucks') || text.includes('restaurant') || text.includes('lunch') || text.includes('meals')) {
    category = 'Meals & Entertainment';
    explanation = 'Client business meeting/lunch.';
  } else if (text.includes('personal') || text.includes('gift') || text.includes('netflix') || text.includes('movie') || text.includes('groceries')) {
    isEligibleWriteoff = false;
    explanation = 'Identified as a personal expense. Not eligible for business write-off.';
  } else if (text.includes('aws') || text.includes('github') || text.includes('software') || text.includes('saas') || text.includes('subscription') || text.includes('server') || text.includes('hardware') || text.includes('equipment')) {
    category = 'Software & Subscriptions';
    explanation = 'Cloud infrastructure and development tools licensing.';
  }

  return {
    amount,
    category,
    isEligibleWriteoff,
    explanation
  };
}

/**
 * Recalculates tax bracket based on YTD Income and determines retroactive adjustment.
 * @param {number} ytdIncome 
 * @param {object} profile 
 * @returns {Promise<{currentBracket: number, retroactiveAdjustment: number}>}
 */
async function evaluateTaxBracket(ytdIncome, profile) {
  // Simple progressive tax bracket threshold simulation
  let newBracket = 0.10;
  if (ytdIncome > 250000) {
    newBracket = 0.32;
  } else if (ytdIncome > 100000) {
    newBracket = 0.24;
  } else if (ytdIncome > 50000) {
    newBracket = 0.22;
  }

  const oldBracket = profile.taxBracket || 0.10;
  let retroactiveAdjustment = 0;

  // If the tax bracket changes, compute retroactive adjustment for YTD income
  if (newBracket > oldBracket) {
    retroactiveAdjustment = ytdIncome * (newBracket - oldBracket);
  }

  return {
    currentBracket: newBracket,
    retroactiveAdjustment: parseFloat(retroactiveAdjustment.toFixed(2))
  };
}

/**
 * Evaluates runway months and triggers recall from yield pool if buffer is low.
 * @param {object} balances 
 * @param {number} targetPaycheck 
 * @returns {Promise<{runwayMonths: number, recallAmount: number, actionTaken: boolean}>}
 */
async function evaluateRunwayAndRecall(balances, targetPaycheck) {
  const salaryBuffer = balances.salary_buffer || 0;
  const yieldPool = balances.yield_pool || 0;
  const reserveFloor = balances.reserve_floor || 0;

  // Runway months = total available funds / monthly burn (2 paychecks per month)
  const monthlyBurn = targetPaycheck * 2;
  const totalAvailable = salaryBuffer + yieldPool + reserveFloor;
  const runwayMonths = monthlyBurn > 0 ? parseFloat((totalAvailable / monthlyBurn).toFixed(2)) : 99;

  let recallAmount = 0;
  let actionTaken = false;

  // If the next paycheck cannot be met by liquid salary buffer, trigger recall
  if (salaryBuffer < targetPaycheck) {
    const deficit = targetPaycheck - salaryBuffer;
    if (yieldPool > 0) {
      recallAmount = Math.min(yieldPool, deficit);
      actionTaken = recallAmount > 0;
    }
  }

  return {
    runwayMonths,
    recallAmount: parseFloat(recallAmount.toFixed(2)),
    actionTaken
  };
}

/**
 * Checks for overdue invoices and generates drafts for follow-ups.
 * @param {Array<object>} invoices 
 * @returns {Promise<Array<{invoiceId: string, client: string, status: string, overdueDays: number, draftEmail: string}>>}
 */
async function checkOverdueInvoices(invoices) {
  const overdueList = [];
  
  for (const inv of invoices) {
    const overdueDays = inv.overdueDays || 0;
    if (inv.status === 'unpaid' && overdueDays >= 14) {
      let tone = 'polite';
      let subject = `Friendly Reminder: Invoice Payment for ${inv.client}`;
      let body = `Hi ${inv.client},\n\nHope you are doing well. This is a gentle reminder that invoice ${inv.invoiceId} is now ${overdueDays} days past due. Please process this at your earliest convenience.\n\nWarm regards,\n[Creator Name]`;

      if (overdueDays >= 21) {
        tone = 'escalated';
        subject = `URGENT: Overdue Invoice for ${inv.client}`;
        body = `Hi ${inv.client},\n\nWe have not received payment for invoice ${inv.invoiceId}, which is now ${overdueDays} days overdue. Please remit payment immediately or contact us to arrange terms.\n\nSincerely,\n[Creator Name]`;
      }

      overdueList.push({
        invoiceId: inv.invoiceId,
        client: inv.client,
        status: inv.status,
        overdueDays,
        draftEmail: `Subject: ${subject}\n\n${body}`
      });
    }
  }

  return overdueList;
}

module.exports = {
  auditReceipt,
  evaluateTaxBracket,
  evaluateRunwayAndRecall,
  checkOverdueInvoices
};
