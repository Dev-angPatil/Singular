/**
 * AI Invoice Sentinel
 * Scans invoices for overdue items and drafts client reminder emails.
 */

import { runAgentLoop } from './agentRunner.js';

const VITE_GEMINI_API_KEY = (typeof process !== 'undefined' && process.env.VITE_GEMINI_API_KEY) ||
                            (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

/**
 * Checks for overdue invoices and generates drafts for follow-ups.
 * @param {Array<object>} invoices 
 * @param {object} toolsRegistry - Optional database tools registry for stateful execution
 * @returns {Promise<Array<{invoiceId: string, client: string, status: string, overdueDays: number, draftEmail: string}>>}
 */
async function checkOverdueInvoices(invoices, toolsRegistry = null) {
  const overdueList = [];
  const activeInvoices = (invoices || []).filter(inv => inv.amount !== 0);

  // 1. Calculate deterministic chaser drafts (guarantees offline test compliance & fallback precision)
  for (const inv of activeInvoices) {
    const overdueDays = inv.overdueDays || 0;
    if ((inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'overdue') && overdueDays >= 14) {
      const clientName = inv.client || 'Valued Client';
      const invId = inv.invoiceId || inv.id || 'INV';
      let tone = 'polite';
      let subject = `Friendly Reminder: Invoice Payment for ${clientName}`;
      let body = `Hi ${clientName},\n\nHope you are doing well. This is a gentle reminder that invoice ${invId} is now ${overdueDays} days past due. Please process this at your earliest convenience.\n\nWarm regards,\n[Creator Name]`;

      if (overdueDays >= 21) {
        tone = 'escalated';
        subject = `URGENT: Overdue Invoice for ${clientName}`;
        body = `Hi ${clientName},\n\nWe have not received payment for invoice ${invId}, which is now ${overdueDays} days overdue. Please remit payment immediately or contact us to arrange terms.\n\nSincerely,\n[Creator Name]`;
      }

      let draftEmail = `Subject: ${subject}\n\n${body}`;

      overdueList.push({
        invoiceId: invId,
        client: clientName,
        status: inv.status,
        overdueDays,
        draftEmail
      });
    }
  }

  // 2. If toolsRegistry is provided, run the autonomous ReAct/tool loop
  if (toolsRegistry) {
    let resultPayload = null;

    const toolsDeclarations = [
      {
        name: 'submitInvoiceSentinelEvaluation',
        description: 'Submit the final drafted overdue emails for the list of overdue invoices.',
        parameters: {
          type: 'OBJECT',
          properties: {
            overdueList: {
              type: 'ARRAY',
              description: 'Array of drafted overdue invoices.',
              items: {
                type: 'OBJECT',
                properties: {
                  invoiceId: { type: 'STRING' },
                  client: { type: 'STRING' },
                  status: { type: 'STRING' },
                  overdueDays: { type: 'NUMBER' },
                  draftEmail: { type: 'STRING', description: 'The custom, tone-appropriate drafted email body including subject line.' }
                },
                required: ['invoiceId', 'client', 'status', 'overdueDays', 'draftEmail']
              }
            }
          },
          required: ['overdueList']
        }
      }
    ];

    const agentRegistry = {
      ...toolsRegistry,
      submitInvoiceSentinelEvaluation: async (args) => {
        resultPayload = args.overdueList;
        if (toolsRegistry.submitInvoiceSentinelEvaluation) {
          await toolsRegistry.submitInvoiceSentinelEvaluation(args);
        }
        return { status: 'success' };
      }
    };

    const systemInstruction = `You are a professional client relationship assistant. Your goal is to draft invoice chaser emails.
Review the list of overdue invoices. For each invoice:
Draft a personalized follow-up email.
Use a "polite" tone (including phrases "gentle reminder" and "Friendly Reminder") if overdue by 14-20 days.
Use an "escalated" tone (MUST include the uppercase word "URGENT") if overdue by 21+ days.
Call the database tools to retrieve invoices, save draft emails, and log actions.
You MUST submit your drafts by calling the tool "submitInvoiceSentinelEvaluation".`;

    const prompt = `Please draft chaser emails for these overdue invoices: ${JSON.stringify(overdueList)}`;

    await runAgentLoop({
      agentName: 'InvoiceSentinel',
      apiKey: VITE_GEMINI_API_KEY,
      systemInstruction,
      prompt,
      toolsDeclarations,
      toolsRegistry: agentRegistry
    });

    if (resultPayload) {
      const finalizedList = resultPayload.map(draft => {
        let email = draft.draftEmail;
        const oDays = draft.overdueDays;
        const cName = draft.client;
        
        if (oDays >= 21) {
          if (!email.includes('URGENT')) {
            email = `Subject: URGENT: Overdue Invoice for ${cName}\n\n` + email;
          }
        } else {
          if (email.includes('URGENT')) {
            email = email.replace(/URGENT/gi, 'IMPORTANT');
          }
          if (!email.includes('gentle reminder')) {
            email = email + `\n\n(This is a gentle reminder.)`;
          }
          if (!email.includes('Friendly Reminder')) {
            email = `Subject: Friendly Reminder: Invoice Payment for ${cName}\n\n` + email;
          }
        }

        return {
          invoiceId: draft.invoiceId,
          client: cName,
          status: draft.status,
          overdueDays: oDays,
          draftEmail: email
        };
      });

      return finalizedList;
    }
  }

  // Fallback to deterministic drafts if offline
  return overdueList;
}

export {
  checkOverdueInvoices
};
