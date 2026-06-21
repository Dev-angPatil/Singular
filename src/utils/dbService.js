import { routeDeposit } from './routingEngine.js';
import { supabase } from './supabaseClient.js';
import { auditReceipt, evaluateTaxBracket } from '../ai/accountant.js';
import { evaluateRunwayAndRecall } from '../ai/treasury.js';
import { checkOverdueInvoices } from '../ai/invoiceSentinel.js';

// --- IN-MEMORY INITIAL STATE SEED DATA ---
const DEFAULT_PROFILE = {
  targetPaycheck: 3500.00,
  reserveFloor: 5000.00,
  taxBracket: 0.24,
  ytdIncome: 71000.00
};

const DEFAULT_BALANCES = {
  tax_pool: 17007.00,
  salary_buffer: 17500.00,
  reserve_floor: 5000.00,
  yield_pool: 20493.00
};

const DEFAULT_INVOICES = [
  { id: 'i0000001', client: 'Acme Corp', amount: 8000.00, status: 'paid', due_date: '2026-04-10', created_at: '2026-03-25T10:00:00Z', updated_at: '2026-04-03T10:05:00Z', overdueDays: 0 },
  { id: 'i0000002', client: 'Wayne Enterprises', amount: 15000.00, status: 'paid', due_date: '2026-05-15', created_at: '2026-04-20T10:00:00Z', updated_at: '2026-05-02T11:05:00Z', overdueDays: 0 },
  { id: 'i0000003', client: 'Stark Industries', amount: 18000.00, status: 'paid', due_date: '2026-06-01', created_at: '2026-05-10T10:00:00Z', updated_at: '2026-05-25T15:05:00Z', overdueDays: 0 },
  { id: 'i0000004', client: 'Stark Industries', amount: 30000.00, status: 'paid', due_date: '2026-06-15', created_at: '2026-05-28T10:00:00Z', updated_at: '2026-06-12T10:35:00Z', overdueDays: 0 },
  { id: 'i0000005', client: 'LexCorp', amount: 4500.00, status: 'overdue', due_date: '2026-06-01', created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z', overdueDays: 19 }
];

const DEFAULT_RECEIPTS = [
  { id: 'r0000001', amount: 150.00, category: 'Office Equipment', is_eligible_writeoff: true, explanation: 'Ergonomic office chair for home workspace', image_url: 'https://supabase.co/storage/receipt_123.jpg', created_at: '2026-04-15T14:30:00Z', confidence_score: 0.96 },
  { id: 'r0000002', amount: 45.00, category: 'Meals', is_eligible_writeoff: false, explanation: 'Client lunch at Starbucks (non-deductible/no receipt)', image_url: null, created_at: '2026-05-10T12:00:00Z', confidence_score: 0.72 }
];

const DEFAULT_TRANSACTIONS = [
  { type: 'deposit', amount: 10000.00, description: 'Onboarding capital allocation', created_at: '2026-04-01T00:00:00Z' },
  { type: 'deposit', amount: 8000.00, description: 'Acme Corp Invoice #101', created_at: '2026-04-03T10:00:00Z' },
  { type: 'tax_allocation', amount: 1760.00, description: 'Tax reservation for Acme Corp Invoice #101', created_at: '2026-04-03T10:01:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-04-10T09:00:00Z' },
  { type: 'writeoff_release', amount: 33.00, description: 'Tax release from writeoff: Ergonomic office chair', created_at: '2026-04-15T14:35:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-04-24T09:00:00Z' },
  { type: 'deposit', amount: 15000.00, description: 'Wayne Enterprises Invoice #102', created_at: '2026-05-02T11:00:00Z' },
  { type: 'tax_allocation', amount: 3300.00, description: 'Tax reservation for Wayne Enterprises Invoice #102', created_at: '2026-05-02T11:01:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-05-08T09:00:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-05-22T09:00:00Z' },
  { type: 'deposit', amount: 18000.00, description: 'Stark Industries Invoice #103', created_at: '2026-05-25T15:00:00Z' },
  { type: 'tax_allocation', amount: 3960.00, description: 'Tax reservation for Stark Industries Invoice #103', created_at: '2026-05-25T15:01:00Z' },
  { type: 'yield_route', amount: 2013.00, description: 'Excess cash routed to Ondo USDY', created_at: '2026-05-25T15:02:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-06-05T09:00:00Z' },
  { type: 'deposit', amount: 30000.00, description: 'Stark Industries Milestone #2', created_at: '2026-06-12T10:30:00Z' },
  { type: 'tax_allocation', amount: 8020.00, description: 'Tax reservation (24% + retroactive adjustment for tax bracket shift)', created_at: '2026-06-12T10:31:00Z' },
  { type: 'yield_route', amount: 18480.00, description: 'Excess cash routed to Ondo USDY', created_at: '2026-06-12T10:32:00Z' },
  { type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-06-19T09:00:00Z' }
];

const DEFAULT_LOGS = [
  { agent: 'treasury', message: 'Treasury Agent initialized. Salary buffer floor set to $5,000, target paycheck set to $3,500.', created_at: '2026-04-01T00:01:00Z' },
  { agent: 'treasury', message: 'Detected incoming deposit of $8,000.00 from Acme Corp Invoice #101.', created_at: '2026-04-03T10:00:00Z' },
  { agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($1,760.00) from Acme Corp deposit.', created_at: '2026-04-03T10:01:00Z' },
  { agent: 'treasury', message: 'OmniFlow routing: Allocated $1,760.00 to Tax Pool, $6,240.00 to Salary Buffer.', created_at: '2026-04-03T10:02:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-04-10T09:00:00Z' },
  { agent: 'accountant', message: 'Tax Accountant Agent audited receipt: $150.00 for Ergonomic office chair. Approved as eligible business write-off.', created_at: '2026-04-15T14:30:00Z' },
  { agent: 'accountant', message: 'Released $33.00 (22% of $150.00) from Tax Pool back to Salary Buffer.', created_at: '2026-04-15T14:35:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-04-24T09:00:00Z' },
  { agent: 'treasury', message: 'Detected incoming deposit of $15,000.00 from Wayne Enterprises Invoice #102.', created_at: '2026-05-02T11:00:00Z' },
  { agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($3,300.00) from Wayne Enterprises deposit.', created_at: '2026-05-02T11:01:00Z' },
  { agent: 'treasury', message: 'OmniFlow routing: Allocated $3,300.00 to Tax Pool, $11,700.00 to Salary Buffer.', created_at: '2026-05-02T11:02:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-05-08T09:00:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-05-22T09:00:00Z' },
  { agent: 'treasury', message: 'Detected incoming deposit of $18,000.00 from Stark Industries Invoice #103.', created_at: '2026-05-25T15:00:00Z' },
  { agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($3,960.00) from Stark Industries deposit.', created_at: '2026-05-25T15:01:00Z' },
  { agent: 'treasury', message: 'OmniFlow routing: Allocated $3,960.00 to Tax Pool, $12,027.00 to Salary Buffer (filled to cap), and routed remaining $2,013.00 to Ondo USDY Yield Pool.', created_at: '2026-05-25T15:02:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-06-05T09:00:00Z' },
  { agent: 'accountant', message: 'Tax Accountant Agent detected YTD income ($71,000.00) crossed threshold. Tax bracket increased from 22% to 24%. Calculated retroactive shortfall of $820.00.', created_at: '2026-06-12T10:29:00Z' },
  { agent: 'treasury', message: 'Detected incoming deposit of $30,000.00 from Stark Industries Milestone #2.', created_at: '2026-06-12T10:30:00Z' },
  { agent: 'treasury', message: 'OmniFlow routing: Allocated $8,020.00 to Tax Pool (24% of $30k + $820.00 adjustment), $3,500.00 to Salary Buffer (filled to cap), and routed remaining $18,480.00 to Ondo USDY Yield Pool.', created_at: '2026-06-12T10:32:00Z' },
  { agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-06-19T09:00:00Z' },
  { agent: 'invoice_sentinel', message: 'Invoice Sentinel scanned LexCorp Invoice #i0000005. Overdue by 19 days. Drafted urgent follow-up reminder email.', created_at: '2026-06-20T18:00:00Z' }
];

const DEFAULT_DRAFTS = [
  {
    invoiceId: 'i0000005',
    client: 'LexCorp',
    status: 'unpaid',
    overdueDays: 19,
    draftEmail: `Subject: Friendly Reminder: Invoice Payment for LexCorp\n\nHi LexCorp,\n\nHope you are doing well. This is a gentle reminder that invoice i0000005 is now 19 days past due. Please process this at your earliest convenience.\n\nWarm regards,\n[Creator Name]`
  }
];

class DbService {
  constructor() {
    this.useSupabase = !!(import.meta.env && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    this.init();
  }

  async init() {
    if (!localStorage.getItem('singular_initialized')) {
      this.resetLocalStorage();
    }
    if (this.useSupabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInWithPassword({
            email: 'demo@singular.ai',
            password: 'password123'
          });
        }
      } catch (e) {
        console.warn("Auto-login to Supabase failed:", e.message);
      }
    }
  }

  resetLocalStorage() {
    localStorage.setItem('singular_profile', JSON.stringify(DEFAULT_PROFILE));
    localStorage.setItem('singular_balances', JSON.stringify(DEFAULT_BALANCES));
    localStorage.setItem('singular_invoices', JSON.stringify(DEFAULT_INVOICES));
    localStorage.setItem('singular_receipts', JSON.stringify(DEFAULT_RECEIPTS));
    localStorage.setItem('singular_transactions', JSON.stringify(DEFAULT_TRANSACTIONS));
    localStorage.setItem('singular_logs', JSON.stringify(DEFAULT_LOGS));
    localStorage.setItem('singular_drafts', JSON.stringify(DEFAULT_DRAFTS));
    localStorage.setItem('singular_current_day', '80'); // Start at day 80 from April 1st (~June 20th)
    localStorage.setItem('singular_initialized', 'true');
  }

  // --- DATABASE HELPERS ---
  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  async logMessage(agent, message) {
    const logs = this.get('singular_logs') || [];
    logs.push({
      agent,
      message,
      created_at: new Date().toISOString()
    });
    this.set('singular_logs', logs);

    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase.from('agent_logs').insert({
            user_id: user.id,
            agent,
            message
          });
        }
      } catch (e) {
        console.warn("Failed to log message to Supabase:", e.message);
      }
    }
  }

  async addTransaction(type, amount, description) {
    const txs = this.get('singular_transactions') || [];
    txs.push({
      type,
      amount,
      description,
      created_at: new Date().toISOString()
    });
    this.set('singular_transactions', txs);

    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase.from('transactions').insert({
            user_id: user.id,
            type,
            amount,
            description
          });
        }
      } catch (e) {
        console.warn("Failed to add transaction to Supabase:", e.message);
      }
    }
  }

  async saveBalances(balances) {
    this.set('singular_balances', balances);
    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase.from('balances').update({
            tax_pool: balances.tax_pool,
            salary_buffer: balances.salary_buffer,
            reserve_floor: balances.reserve_floor,
            yield_pool: balances.yield_pool
          }).eq('user_id', user.id);
        }
      } catch (e) {
        console.warn("Failed to save balances to Supabase:", e.message);
      }
    }
  }

  // --- GETTERS ---
  async getProfile() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('profiles').select('*').single();
      if (!error && data) {
        return {
          targetPaycheck: Number(data.target_paycheck),
          reserveFloor: Number(data.reserve_floor),
          taxBracket: Number(data.tax_bracket),
          ytdIncome: Number(data.ytd_income),
          useProgressiveTax: Boolean(data.use_progressive_tax)
        };
      }
    }
    return this.get('singular_profile');
  }

  async getBalances() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('balances').select('*').single();
      if (!error && data) {
        return {
          tax_pool: Number(data.tax_pool),
          salary_buffer: Number(data.salary_buffer),
          reserve_floor: Number(data.reserve_floor),
          yield_pool: Number(data.yield_pool)
        };
      }
    }
    return this.get('singular_balances');
  }

  async getInvoices() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
      if (!error && data) return data;
    }
    return this.get('singular_invoices') || [];
  }

  async getReceipts() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('receipts').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return this.get('singular_receipts') || [];
  }

  async getTransactions() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    const txs = this.get('singular_transactions') || [];
    return [...txs].reverse(); // newest first
  }

  async getLogs() {
    if (this.useSupabase) {
      const { data, error } = await supabase.from('agent_logs').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    const logs = this.get('singular_logs') || [];
    return [...logs].reverse(); // newest first
  }

  async getDrafts() {
    return this.get('singular_drafts') || [];
  }

  // --- ACTIONS & SIMULATED EVENTS ---

  async updateProfile(updates) {
    const profile = await this.getProfile();
    const updated = { ...profile, ...updates };
    this.set('singular_profile', updated);

    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase.from('profiles').update({
            target_paycheck: updated.targetPaycheck,
            reserve_floor: updated.reserveFloor,
            tax_bracket: updated.taxBracket,
            ytd_income: updated.ytdIncome
          }).eq('id', user.id);
        }
      } catch (e) {
        console.warn("Failed to update profile in Supabase:", e.message);
      }
    }
    
    await this.logMessage('treasury', `Profile settings updated manually. Paycheck: $${updated.targetPaycheck}, Reserve: $${updated.reserveFloor}`);
  }

  /**
   * Builds the database tool registry for autonomous agents
   */
  createToolsRegistry(agentName) {
    return {
      getProfile: async () => {
        return await this.getProfile();
      },
      getBalances: async () => {
        return await this.getBalances();
      },
      getInvoices: async () => {
        return await this.getInvoices();
      },
      getReceipts: async () => {
        return await this.getReceipts();
      },
      updateProfile: async (updates) => {
        const profile = await this.getProfile();
        const updated = { ...profile, ...updates };
        this.set('singular_profile', updated);
        if (this.useSupabase) {
          try {
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
              await supabase.from('profiles').update({
                target_paycheck: updated.targetPaycheck,
                reserve_floor: updated.reserveFloor,
                tax_bracket: updated.taxBracket,
                ytd_income: updated.ytdIncome
              }).eq('id', user.id);
            }
          } catch (e) {
            console.warn("Failed to update profile in Supabase:", e.message);
          }
        }
        return { status: 'success' };
      },
      updateBalances: async (balances) => {
        await this.saveBalances(balances);
        return { status: 'success' };
      },
      addTransaction: async (args) => {
        await this.addTransaction(args.type, args.amount, args.description);
        return { status: 'success' };
      },
      addReceipt: async (args) => {
        const receipts = this.get('singular_receipts') || [];
        const newReceipt = {
          id: 'r' + Math.random().toString(36).substr(2, 7),
          amount: args.amount,
          category: args.category,
          is_eligible_writeoff: args.isEligibleWriteoff,
          explanation: args.explanation,
          confidence_score: args.confidenceScore !== undefined ? args.confidenceScore : 0.95,
          image_url: null,
          created_at: new Date().toISOString()
        };
        receipts.push(newReceipt);
        this.set('singular_receipts', receipts);
        if (this.useSupabase) {
          try {
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
              await supabase.from('receipts').insert({
                user_id: user.id,
                amount: args.amount,
                category: args.category,
                is_eligible_writeoff: args.isEligibleWriteoff,
                explanation: args.explanation,
                image_url: null
              });
            }
          } catch (e) {
            console.warn("Failed to insert receipt to Supabase:", e.message);
          }
        }
        return newReceipt;
      },
      saveDraftEmail: async (args) => {
        const drafts = this.get('singular_drafts') || [];
        const exists = drafts.some(d => d.invoiceId === args.invoiceId && d.overdueDays === args.overdueDays);
        if (!exists) {
          drafts.push(args);
          this.set('singular_drafts', drafts);
        }
        return { status: 'success' };
      },
      logReasoning: async (args) => {
        await this.logMessage(agentName, args.message);
        return { status: 'success' };
      }
    };
  }

  async simulateInvoicePaid(invoiceIdOrAmount) {
    let amount = 0;
    let description = 'Direct Client Deposit';
    let clientName = 'Client';

    const invoices = await this.getInvoices();

    if (typeof invoiceIdOrAmount === 'string') {
      const inv = invoices.find(i => i.id === invoiceIdOrAmount || i.invoiceId === invoiceIdOrAmount);
      if (inv) {
        amount = inv.amount;
        clientName = inv.client;
        description = `${inv.client} Invoice #${inv.id || inv.invoiceId}`;
        inv.status = 'paid';
        inv.overdueDays = 0;
        inv.updated_at = new Date().toISOString();
        this.set('singular_invoices', invoices);

        if (this.useSupabase) {
          try {
            await supabase.from('invoices').update({
              status: 'paid',
              updated_at: new Date().toISOString()
            }).eq('id', inv.id);
          } catch (e) {
            console.warn("Failed to update invoice in Supabase:", e.message);
          }
        }

        // Remove from drafts if overdue
        const drafts = this.get('singular_drafts') || [];
        const updatedDrafts = drafts.filter(d => d.invoiceId !== invoiceIdOrAmount);
        this.set('singular_drafts', updatedDrafts);
      }
    } else if (typeof invoiceIdOrAmount === 'number') {
      amount = invoiceIdOrAmount;
    }

    if (amount <= 0 || isNaN(amount)) {
      await this.logMessage('treasury', 'Rejected invalid invoice payment simulation: $0 or NaN');
      return;
    }

    const profile = await this.getProfile();
    const endIncome = (profile.ytdIncome || 0) + amount;

    // Trigger the Tax Accountant Agent ReAct loop to route deposit
    const registry = this.createToolsRegistry('accountant');
    await evaluateTaxBracket(endIncome, profile, registry);
  }

  async simulateMilestonePaid(amount) {
    await this.simulateInvoicePaid(amount);
  }

  async simulateReceiptUpload(rawText, amountInput = null) {
    const text = (rawText || '').trim();
    
    // Trigger the Tax Accountant Agent ReAct loop to audit receipt
    const registry = this.createToolsRegistry('accountant');
    const promptText = amountInput !== null 
      ? `Audit receipt text: "${text}", override amount to $${amountInput}`
      : `Audit receipt text: "${text}"`;

    const receipts = this.get('singular_receipts') || [];
    const beforeCount = receipts.length;

    const auditResult = await auditReceipt(null, promptText, registry);

    // Get the newly registered receipt
    const updatedReceipts = this.get('singular_receipts') || [];
    if (updatedReceipts.length > beforeCount) {
      return updatedReceipts[updatedReceipts.length - 1];
    } else {
      const newRec = {
        id: 'r' + Math.random().toString(36).substr(2, 7),
        amount: auditResult.amount,
        category: auditResult.category,
        is_eligible_writeoff: auditResult.isEligibleWriteoff,
        explanation: auditResult.explanation,
        confidence_score: auditResult.confidenceScore !== undefined ? auditResult.confidenceScore : 0.95,
        image_url: null,
        created_at: new Date().toISOString()
      };
      updatedReceipts.push(newRec);
      this.set('singular_receipts', updatedReceipts);
      return newRec;
    }
  }

  async simulateClientCancellation() {
    const balances = await this.getBalances();
    const profile = await this.getProfile();

    // Trigger the Treasury Agent ReAct loop to evaluate runway
    const registry = this.createToolsRegistry('treasury');
    await evaluateRunwayAndRecall(balances, profile.targetPaycheck, registry);
  }

  async fastForward(days) {
    if (days < 0) {
      throw new Error("Fast-forward days cannot be negative");
    }
    const profile = await this.getProfile();
    const invoices = await this.getInvoices();
    let currentDay = parseInt(localStorage.getItem('singular_current_day') || '0', 10);

    for (let i = 1; i <= days; i++) {
      // Age invoices
      for (const inv of invoices) {
        if (inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'overdue') {
          inv.overdueDays = (inv.overdueDays || 0) + 1;
          if (inv.overdueDays >= 14) {
            inv.status = 'overdue';
          }
        }
      }
      currentDay++;

      // Dispatch paycheck (every 14 days)
      if (currentDay % 14 === 0) {
        const paycheck = profile.targetPaycheck;
        const balances = await this.getBalances();

        // Trigger the Treasury Agent ReAct loop to process paycheck cycle
        const registry = this.createToolsRegistry('treasury');
        await evaluateRunwayAndRecall(balances, paycheck, registry);
      }
    }

    // Save back aged invoices
    this.set('singular_invoices', invoices);
    localStorage.setItem('singular_current_day', currentDay.toString());

    if (this.useSupabase) {
      try {
        for (const inv of invoices) {
          await supabase.from('invoices').update({
            status: inv.status,
            updated_at: new Date().toISOString()
          }).eq('id', inv.id);
        }
      } catch (e) {
        console.warn("Failed to sync aged invoices to Supabase:", e.message);
      }
    }

    // Trigger the Invoice Sentinel Agent ReAct loop to check overdue invoices
    const sentinelRegistry = this.createToolsRegistry('invoice_sentinel');
    await checkOverdueInvoices(invoices, sentinelRegistry);
  }

  async manualRecallYield(amount) {
    const balances = await this.getBalances();
    if (amount <= 0 || isNaN(amount)) return;
    
    // Trigger the Treasury Agent ReAct loop to perform manual recall
    const registry = this.createToolsRegistry('treasury');
    await evaluateRunwayAndRecall(balances, amount, registry);
  }

  async verifyReceipt(receiptId) {
    const receipts = this.get('singular_receipts') || [];
    const rec = receipts.find(r => r.id === receiptId);
    if (rec) {
      rec.confidence_score = 1.0; // Mark as verified by setting confidence to 1.0
      this.set('singular_receipts', receipts);
      await this.logMessage('accountant', `Auditor reviewed and verified receipt ${receiptId} as correct.`);
    }
  }

  async approveAndSendDraft(invoiceId) {
    const drafts = this.get('singular_drafts') || [];
    const draft = drafts.find(d => d.invoiceId === invoiceId);
    if (draft) {
      draft.status = 'sent';
      this.set('singular_drafts', drafts);
      await this.logMessage('invoice_sentinel', `Approved and sent follow-up email reminder to ${draft.client} for invoice #${invoiceId}.`);
    }
  }

  async addInvoice(client, amount, dueDateDaysFromNow) {
    const invoices = await this.getInvoices();
    const due = new Date();
    due.setDate(due.getDate() + dueDateDaysFromNow);
    const newInv = {
      id: 'i' + Math.random().toString(36).substr(2, 7),
      client,
      amount: parseFloat(amount),
      status: 'pending',
      due_date: due.toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      overdueDays: 0
    };
    invoices.push(newInv);
    this.set('singular_invoices', invoices);

    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase.from('invoices').insert({
            id: newInv.id,
            user_id: user.id,
            client,
            amount: parseFloat(amount),
            status: 'pending',
            due_date: due.toISOString().split('T')[0]
          });
        }
      } catch (e) {
        console.warn("Failed to insert invoice to Supabase:", e.message);
      }
    }

    await this.logMessage('treasury', `Created new invoice for ${client} of $${parseFloat(amount).toFixed(2)}.`);
    return newInv;
  }

  async reset() {
    this.resetLocalStorage();
    if (this.useSupabase) {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          // Delete custom transactions, receipts, logs, and reset invoices
          await supabase.from('transactions').delete().eq('user_id', user.id);
          await supabase.from('receipts').delete().eq('user_id', user.id);
          await supabase.from('agent_logs').delete().eq('user_id', user.id);
          await supabase.from('invoices').delete().eq('user_id', user.id);

          // Reset profile to default
          await supabase.from('profiles').update({
            target_paycheck: DEFAULT_PROFILE.targetPaycheck,
            reserve_floor: DEFAULT_PROFILE.reserveFloor,
            tax_bracket: DEFAULT_PROFILE.taxBracket,
            ytd_income: DEFAULT_PROFILE.ytdIncome
          }).eq('id', user.id);

          // Reset balances to default
          await supabase.from('balances').update({
            tax_pool: DEFAULT_BALANCES.tax_pool,
            salary_buffer: DEFAULT_BALANCES.salary_buffer,
            reserve_floor: DEFAULT_BALANCES.reserve_floor,
            yield_pool: DEFAULT_BALANCES.yield_pool
          }).eq('user_id', user.id);

          // Re-insert seeded invoices
          const baseUserUuid = user.id;
          const seedInvoices = [
            { id: 'i0000001', user_id: baseUserUuid, client: 'Acme Corp', amount: 8000.00, status: 'paid', due_date: '2026-04-10', created_at: '2026-03-25T10:00:00Z', updated_at: '2026-04-03T10:05:00Z' },
            { id: 'i0000002', user_id: baseUserUuid, client: 'Wayne Enterprises', amount: 15000.00, status: 'paid', due_date: '2026-05-15', created_at: '2026-04-20T10:00:00Z', updated_at: '2026-05-02T11:05:00Z' },
            { id: 'i0000003', user_id: baseUserUuid, client: 'Stark Industries', amount: 18000.00, status: 'paid', due_date: '2026-06-01', created_at: '2026-05-10T10:00:00Z', updated_at: '2026-05-25T15:05:00Z' },
            { id: 'i0000004', user_id: baseUserUuid, client: 'Stark Industries', amount: 30000.00, status: 'paid', due_date: '2026-06-15', created_at: '2026-05-28T10:00:00Z', updated_at: '2026-06-12T10:35:00Z' },
            { id: 'i0000005', user_id: baseUserUuid, client: 'LexCorp', amount: 4500.00, status: 'overdue', due_date: '2026-06-01', created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z' }
          ];
          await supabase.from('invoices').insert(seedInvoices);

          // Re-insert seeded receipts
          const seedReceipts = [
            { id: 'r0000001', user_id: baseUserUuid, amount: 150.00, category: 'Office Equipment', is_eligible_writeoff: true, explanation: 'Ergonomic office chair for home workspace', image_url: 'https://supabase.co/storage/receipt_123.jpg', created_at: '2026-04-15T14:30:00Z' },
            { id: 'r0000002', user_id: baseUserUuid, amount: 45.00, category: 'Meals', is_eligible_writeoff: false, explanation: 'Client lunch at Starbucks (non-deductible/no receipt)', image_url: null, created_at: '2026-05-10T12:00:00Z' }
          ];
          await supabase.from('receipts').insert(seedReceipts);

          // Re-insert seeded transactions
          const seedTransactions = [
            { user_id: baseUserUuid, type: 'deposit', amount: 10000.00, description: 'Onboarding capital allocation', created_at: '2026-04-01T00:00:00Z' },
            { user_id: baseUserUuid, type: 'deposit', amount: 8000.00, description: 'Acme Corp Invoice #101', created_at: '2026-04-03T10:00:00Z' },
            { user_id: baseUserUuid, type: 'tax_allocation', amount: 1760.00, description: 'Tax reservation for Acme Corp Invoice #101', created_at: '2026-04-03T10:01:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-04-10T09:00:00Z' },
            { user_id: baseUserUuid, type: 'writeoff_release', amount: 33.00, description: 'Tax release from writeoff: Ergonomic office chair', created_at: '2026-04-15T14:35:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-04-24T09:00:00Z' },
            { user_id: baseUserUuid, type: 'deposit', amount: 15000.00, description: 'Wayne Enterprises Invoice #102', created_at: '2026-05-02T11:00:00Z' },
            { user_id: baseUserUuid, type: 'tax_allocation', amount: 3300.00, description: 'Tax reservation for Wayne Enterprises Invoice #102', created_at: '2026-05-02T11:01:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-05-08T09:00:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-05-22T09:00:00Z' },
            { user_id: baseUserUuid, type: 'deposit', amount: 18000.00, description: 'Stark Industries Invoice #103', created_at: '2026-05-25T15:00:00Z' },
            { user_id: baseUserUuid, type: 'tax_allocation', amount: 3960.00, description: 'Tax reservation for Stark Industries Invoice #103', created_at: '2026-05-25T15:01:00Z' },
            { user_id: baseUserUuid, type: 'yield_route', amount: 2013.00, description: 'Excess cash routed to Ondo USDY', created_at: '2026-05-25T15:02:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-06-05T09:00:00Z' },
            { user_id: baseUserUuid, type: 'deposit', amount: 30000.00, description: 'Stark Industries Milestone #2', created_at: '2026-06-12T10:30:00Z' },
            { user_id: baseUserUuid, type: 'tax_allocation', amount: 8020.00, description: 'Tax reservation (24% + retroactive adjustment for tax bracket shift)', created_at: '2026-06-12T10:31:00Z' },
            { user_id: baseUserUuid, type: 'yield_route', amount: 18480.00, description: 'Excess cash routed to Ondo USDY', created_at: '2026-06-12T10:32:00Z' },
            { user_id: baseUserUuid, type: 'paycheck_payout', amount: 3500.00, description: 'Bi-weekly payroll', created_at: '2026-06-19T09:00:00Z' }
          ];
          await supabase.from('transactions').insert(seedTransactions);

          // Re-insert seeded logs
          const seedLogs = [
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent initialized. Salary buffer floor set to $5,000, target paycheck set to $3,500.', created_at: '2026-04-01T00:01:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Detected incoming deposit of $8,000.00 from Acme Corp Invoice #101.', created_at: '2026-04-03T10:00:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($1,760.00) from Acme Corp deposit.', created_at: '2026-04-03T10:01:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'OmniFlow routing: Allocated $1,760.00 to Tax Pool, $6,240.00 to Salary Buffer.', created_at: '2026-04-03T10:02:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-04-10T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Tax Accountant Agent audited receipt: $150.00 for Ergonomic office chair. Approved as eligible business write-off.', created_at: '2026-04-15T14:30:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Released $33.00 (22% of $150.00) from Tax Pool back to Salary Buffer.', created_at: '2026-04-15T14:35:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-04-24T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Detected incoming deposit of $15,000.00 from Wayne Enterprises Invoice #102.', created_at: '2026-05-02T11:00:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($3,300.00) from Wayne Enterprises deposit.', created_at: '2026-05-02T11:01:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'OmniFlow routing: Allocated $3,300.00 to Tax Pool, $11,700.00 to Salary Buffer.', created_at: '2026-05-02T11:02:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-05-08T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-05-22T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Detected incoming deposit of $18,000.00 from Stark Industries Invoice #103.', created_at: '2026-05-25T15:00:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Tax Accountant Agent computed 22% tax allocation ($3,960.00) from Stark Industries deposit.', created_at: '2026-05-25T15:01:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'OmniFlow routing: Allocated $3,960.00 to Tax Pool, $12,027.00 to Salary Buffer (filled to cap), and routed remaining $2,013.00 to Ondo USDY Yield Pool.', created_at: '2026-05-25T15:02:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-06-05T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'accountant', message: 'Tax Accountant Agent detected YTD income ($71,000.00) crossed threshold. Tax bracket increased from 22% to 24%. Calculated retroactive shortfall of $820.00.', created_at: '2026-06-12T10:29:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Detected incoming deposit of $30,000.00 from Stark Industries Milestone #2.', created_at: '2026-06-12T10:30:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'OmniFlow routing: Allocated $8,020.00 to Tax Pool (24% of $30k + $820.00 adjustment), $3,500.00 to Salary Buffer (filled to cap), and routed remaining $18,480.00 to Ondo USDY Yield Pool.', created_at: '2026-06-12T10:32:00Z' },
            { user_id: baseUserUuid, agent: 'treasury', message: 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', created_at: '2026-06-19T09:00:00Z' },
            { user_id: baseUserUuid, agent: 'invoice_sentinel', message: 'Invoice Sentinel scanned LexCorp Invoice #i0000005. Overdue by 19 days. Drafted urgent follow-up reminder email.', created_at: '2026-06-20T18:00:00Z' }
          ];
          await supabase.from('agent_logs').insert(seedLogs);
        }
      } catch (e) {
        console.warn("Reset of Supabase database failed:", e.message);
      }
    }
  }
}

export const dbService = new DbService();
export default dbService;
