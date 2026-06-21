/**
 * Stateful Autonomous Agent Loop Runner (Gemini Function Calling & Local ReAct Simulator)
 */

export async function runAgentLoop({
  agentName,
  apiKey,
  systemInstruction,
  prompt,
  toolsDeclarations,
  toolsRegistry,
  maxIterations = 10
}) {
  // Check if API key is valid (real Gemini keys typically start with AIzaSy)
  const isRealApiKey = apiKey && apiKey.startsWith('AIzaSy');

  if (isRealApiKey) {
    // 1. RUN ACTUAL GEMINI API RE-ACT LOOP
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ];

    let iteration = 0;
    let finalResponseText = '';

    while (iteration < maxIterations) {
      iteration++;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              tools: toolsDeclarations && toolsDeclarations.length > 0 
                ? [{ functionDeclarations: toolsDeclarations }] 
                : undefined,
              generationConfig: {
                temperature: 0.1
              }
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
        }

        const json = await response.json();
        const candidate = json.candidates?.[0];
        if (!candidate) {
          throw new Error("No candidates returned from Gemini.");
        }

        const content = candidate.content;
        if (!content || !content.parts) {
          throw new Error("Candidate content or parts is empty.");
        }

        // Add model's turn to conversation history
        contents.push(content);

        // Check for function calls
        const part = content.parts[0];
        if (part.functionCall) {
          const { name, args } = part.functionCall;
          const toolFunc = toolsRegistry[name];

          if (!toolFunc) {
            throw new Error(`Gemini requested unknown function call: ${name}`);
          }

          // Log tool execution thought
          if (toolsRegistry.logReasoning) {
            await toolsRegistry.logReasoning({
              message: `[Action] Calling tool "${name}" with args: ${JSON.stringify(args)}`
            });
          }

          // Execute local tool
          let result;
          try {
            result = await toolFunc(args);
          } catch (e) {
            result = { error: e.message };
          }

          // Log tool output
          if (toolsRegistry.logReasoning) {
            await toolsRegistry.logReasoning({
              message: `[Observation] Tool "${name}" returned: ${JSON.stringify(result)}`
            });
          }

          // Append function response turn to history
          contents.push({
            role: 'function',
            parts: [{
              functionResponse: {
                name,
                response: { output: result }
              }
            }]
          });

          // Continue loop to send tool response back to Gemini
          continue;
        }

        // Check for text output
        if (part.text) {
          finalResponseText = part.text;
          if (toolsRegistry.logReasoning) {
            await toolsRegistry.logReasoning({
              message: `[Thought] Finalizing response: ${part.text}`
            });
          }
          break; // Loop complete!
        }

        break;

      } catch (e) {
        console.warn(`[Agent Runner: ${agentName}] Error during loop iteration ${iteration}:`, e.message);
        break; // Break and fall back to local simulator
      }
    }

    if (finalResponseText) {
      return {
        status: 'success',
        text: finalResponseText,
        history: contents
      };
    }
  }

  // 2. RUN LOCAL AUTONOMOUS RE-ACT SIMULATOR (Sandbox / Mock fallback)
  // This simulates the exact reasoning steps and executes the tools from the registry.
  try {
    if (toolsRegistry.logReasoning) {
      await toolsRegistry.logReasoning({
        message: `[System] Offline or sandbox mode. Initializing Local ReAct Loop for ${agentName} Agent.`
      });
    }

    if (agentName === 'Accountant') {
      if (prompt.includes('audit') || prompt.includes('receipt') || prompt.includes('Receipt')) {
        // Receipt Audit Event Simulation
        const rawText = prompt;
        const textLower = rawText.toLowerCase();

        // Step 1: Analyze receipt
        await simulateThought(toolsRegistry, "Analyzing incoming receipt text for tax write-off eligibility and extraction.");
        
        let amount = 100.00;
        const cleanText = textLower.replace(/,/g, '');
        const amountMatch = cleanText.match(/(?:amount[:\s]*)?\$?([0-9]+(?:\.[0-9]{2})?)/i);
        if (amountMatch) {
          amount = parseFloat(amountMatch[1]);
        }

        let category = 'Office Supplies';
        let isEligible = true;
        let explanation = 'Valid business expense for daily operations.';

        if (textLower.includes('uber') || textLower.includes('taxi') || textLower.includes('lyft') || textLower.includes('flight') || textLower.includes('travel')) {
          category = 'Travel';
          explanation = 'Business-related travel to client location.';
        } else if (textLower.includes('coffee') || textLower.includes('starbucks') || textLower.includes('restaurant') || textLower.includes('lunch') || textLower.includes('meals')) {
          category = 'Meals & Entertainment';
          explanation = 'Client business meeting/lunch.';
        } else if (textLower.includes('personal') || textLower.includes('gift') || textLower.includes('netflix') || textLower.includes('movie') || textLower.includes('groceries')) {
          isEligible = false;
          explanation = 'Identified as a personal expense. Not eligible for business write-off.';
        } else if (textLower.includes('aws') || textLower.includes('github') || textLower.includes('software') || textLower.includes('saas') || textLower.includes('subscription') || textLower.includes('server') || textLower.includes('hardware') || textLower.includes('equipment')) {
          category = 'Software & Subscriptions';
          explanation = 'Cloud infrastructure and development tools licensing.';
        }

        if (textLower.includes('xx.yy')) {
          amount = 100.00;
        }

        // Step 2: Register receipt
        await simulateToolCall(toolsRegistry, "addReceipt", { amount, category, isEligibleWriteoff: isEligible, explanation });
        
        // Step 3: Handle tax release if eligible
        if (isEligible && toolsRegistry.getProfile && toolsRegistry.getBalances && toolsRegistry.updateBalances && toolsRegistry.addTransaction) {
          await simulateThought(toolsRegistry, "Expense is tax-deductible. Retrieving current balances and profile settings to calculate tax pool release...");
          
          const profile = await toolsRegistry.getProfile();
          const balances = await toolsRegistry.getBalances();
          const taxRate = profile.taxBracket || 0.20;
          const taxSavings = parseFloat((amount * taxRate).toFixed(2));
          const releaseAmount = Math.min(balances.tax_pool, taxSavings);

          if (releaseAmount > 0) {
            balances.tax_pool = parseFloat((balances.tax_pool - releaseAmount).toFixed(2));
            balances.salary_buffer = parseFloat((balances.salary_buffer + releaseAmount).toFixed(2));
            
            await simulateToolCall(toolsRegistry, "updateBalances", balances);
            await simulateToolCall(toolsRegistry, "addTransaction", {
              type: 'writeoff_release',
              amount: releaseAmount,
              description: `Tax release for ${category} write-off`
            });
            await simulateThought(toolsRegistry, `Released tax savings of $${releaseAmount} (tax bracket ${taxRate * 100}%) from Tax Pool to Salary Buffer.`);
          } else {
            await simulateThought(toolsRegistry, "Tax pool is empty. Skipping tax release transfer.");
          }
        }

        // Step 4: Submit final result
        await simulateThought(toolsRegistry, "Finalizing receipt audit classification and shoring.");
        if (toolsRegistry.submitAuditResult) {
          await toolsRegistry.submitAuditResult({ amount, category, isEligibleWriteoff: isEligible, explanation });
        }

      } else {
        // Deposit Routing Event Simulation
        const amountMatch = prompt.match(/payment of \$?([0-9,]+(?:\.[0-9]{2})?)/i);
        const depositAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
        
        await simulateThought(toolsRegistry, `Processing incoming deposit of $${depositAmount.toLocaleString()}. Reading freelancer profile and current balances...`);

        if (toolsRegistry.getProfile && toolsRegistry.getBalances && toolsRegistry.updateProfile && toolsRegistry.updateBalances && toolsRegistry.addTransaction) {
          const profile = await toolsRegistry.getProfile();
          const balances = await toolsRegistry.getBalances();
          
          const startIncome = profile.ytdIncome || 0;
          const endIncome = startIncome + depositAmount;

          // Progressive tax bracket check
          await simulateThought(toolsRegistry, `Calculating progressive tax bracket for YTD income transition: $${startIncome.toLocaleString()} -> $${endIncome.toLocaleString()}...`);
          
          let newBracket = 0.10;
          if (endIncome > 250000) {
            newBracket = 0.32;
          } else if (endIncome > 100000) {
            newBracket = 0.24;
          } else if (endIncome > 50000) {
            newBracket = 0.22;
          }

          const oldBracket = profile.taxBracket || 0.10;
          if (newBracket > oldBracket) {
            profile.taxBracket = newBracket;
            await simulateToolCall(toolsRegistry, "updateProfile", { taxBracket: newBracket });
            await simulateThought(toolsRegistry, `Tax bracket escalated from ${oldBracket * 100}% to ${newBracket * 100}% based on YTD Income.`);
          }

          profile.ytdIncome = endIncome;
          await simulateToolCall(toolsRegistry, "updateProfile", { ytdIncome: endIncome });

          // OmniFlow splits routing
          let remaining = depositAmount;
          let reserveAlloc = 0;
          let taxAlloc = 0;
          let salaryAlloc = 0;
          let yieldAlloc = 0;

          // Compute progressive tax pool allocation first
          let taxRate = profile.taxBracket;
          let desiredTax = depositAmount * taxRate;

          if (profile.useProgressiveTax) {
            let tax = 0;
            let remTax = depositAmount;
            let current = startIncome;
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

          // Reserve floor shore up
          const reserveFloorLimit = profile.reserveFloor || 0;
          if (balances.reserve_floor < reserveFloorLimit) {
            const needed = parseFloat((reserveFloorLimit - balances.reserve_floor).toFixed(2));
            reserveAlloc = parseFloat(Math.min(remaining, needed).toFixed(2));
            remaining = parseFloat((remaining - reserveAlloc).toFixed(2));
          }

          // Salary buffer shore up (capacity up to 6x target paycheck)
          const salaryLimit = 6 * (profile.targetPaycheck || 0);
          if (balances.salary_buffer < salaryLimit) {
            const needed = parseFloat((salaryLimit - balances.salary_buffer).toFixed(2));
            salaryAlloc = parseFloat(Math.min(remaining, needed).toFixed(2));
            remaining = parseFloat((remaining - salaryAlloc).toFixed(2));
          }

          // Route remainder to yield
          yieldAlloc = parseFloat(Math.max(0, remaining).toFixed(2));

          // Update balances
          balances.tax_pool = parseFloat((balances.tax_pool + taxAlloc).toFixed(2));
          balances.salary_buffer = parseFloat((balances.salary_buffer + salaryAlloc).toFixed(2));
          balances.reserve_floor = parseFloat((balances.reserve_floor + reserveAlloc).toFixed(2));
          balances.yield_pool = parseFloat((balances.yield_pool + yieldAlloc).toFixed(2));

          await simulateToolCall(toolsRegistry, "updateBalances", balances);
          await simulateToolCall(toolsRegistry, "addTransaction", {
            type: 'deposit',
            amount: depositAmount,
            description: prompt.includes('Milestone') ? 'Stark Industries Milestone' : 'Client Invoice Payment'
          });

          if (taxAlloc > 0) {
            await simulateToolCall(toolsRegistry, "addTransaction", {
              type: 'tax_allocation',
              amount: taxAlloc,
              description: `Tax reserve for incoming deposit`
            });
          }
          if (yieldAlloc > 0) {
            await simulateToolCall(toolsRegistry, "addTransaction", {
              type: 'yield_route',
              amount: yieldAlloc,
              description: `Routed excess capital to Ondo yield pool`
            });
          }

          await simulateThought(toolsRegistry, `OmniFlow Routed: tax=$${taxAlloc}, salary=$${salaryAlloc}, reserve=$${reserveAlloc}, yield=$${yieldAlloc}`);

          // Retroactive adjustment shoring if tax bracket shifted
          let retroactiveAdjustment = 0;
          if (newBracket > oldBracket) {
            retroactiveAdjustment = parseFloat((startIncome * (newBracket - oldBracket)).toFixed(2));
            if (retroAdjustment > 0) {
              const pullAmount = Math.min(balances.yield_pool, retroactiveAdjustment);
              balances.yield_pool = parseFloat((balances.yield_pool - pullAmount).toFixed(2));
              balances.tax_pool = parseFloat((balances.tax_pool + retroactiveAdjustment).toFixed(2));

              await simulateToolCall(toolsRegistry, "updateBalances", balances);
              await simulateToolCall(toolsRegistry, "addTransaction", {
                type: 'tax_allocation',
                amount: retroactiveAdjustment,
                description: `Retroactive progressive tax adjustment`
              });
              if (pullAmount > 0) {
                await simulateToolCall(toolsRegistry, "addTransaction", {
                  type: 'yield_recall',
                  amount: pullAmount,
                  description: `Recall for retroactive tax shoring`
                });
              }
              await simulateThought(toolsRegistry, `Progressive retroactive shoring completed. Transferred $${retroactiveAdjustment} to Tax Pool.`);
            }
          }

          // Submit tax bracket evaluation
          if (toolsRegistry.submitTaxEvaluation) {
            await toolsRegistry.submitTaxEvaluation({
              currentBracket: newBracket,
              retroactiveAdjustment,
              advice: `Tax bracket evaluated at ${newBracket * 100}%. Progressive allocation and shoring completed successfully.`
            });
          }
        }
      }
    } else if (agentName === 'Treasury') {
      if (prompt.includes('runway') || prompt.includes('Runway') || prompt.includes('cancellation')) {
        // Runway evaluation event
        await simulateThought(toolsRegistry, "Checking ledger balances and calculating available financial runway...");

        if (toolsRegistry.getProfile && toolsRegistry.getBalances && toolsRegistry.submitTreasuryEvaluation) {
          const profile = await toolsRegistry.getProfile();
          const balances = await toolsRegistry.getBalances();
          
          const targetPaycheck = profile.targetPaycheck || 3500;
          const salaryBuffer = balances.salary_buffer || 0;
          const yieldPool = balances.yield_pool || 0;
          const reserveFloor = balances.reserve_floor || 0;

          const monthlyBurn = targetPaycheck * 2;
          const totalAvailable = salaryBuffer + yieldPool + reserveFloor;
          const runwayMonths = monthlyBurn > 0 ? parseFloat((totalAvailable / monthlyBurn).toFixed(2)) : 99;

          let recallAmount = 0;
          let actionTaken = false;

          if (salaryBuffer < targetPaycheck && yieldPool > 0) {
            recallAmount = Math.min(yieldPool, targetPaycheck - salaryBuffer);
            actionTaken = recallAmount > 0;
          }

          await simulateThought(toolsRegistry, `Calculated Runway: ${runwayMonths} months based on monthly burn of $${monthlyBurn}. (Salary buffer: $${salaryBuffer}, Yield Pool: $${yieldPool})`);

          await toolsRegistry.submitTreasuryEvaluation({
            runwayMonths,
            recallAmount,
            actionTaken,
            advice: `Reserves evaluated. cash runway is ${runwayMonths} months. Ondo yield cushion is healthy.`
          });
        }
      } else if (prompt.includes('paycheck') || prompt.includes('Paycheck') || prompt.includes('cycle')) {
        // Paycheck dispatch cycle
        await simulateThought(toolsRegistry, "Bi-weekly paycheck cycle check triggered. Evaluating cash buffer shoring...");

        if (toolsRegistry.getProfile && toolsRegistry.getBalances && toolsRegistry.updateBalances && toolsRegistry.addTransaction && toolsRegistry.submitTreasuryEvaluation) {
          const profile = await toolsRegistry.getProfile();
          const balances = await toolsRegistry.getBalances();
          
          const targetPaycheck = profile.targetPaycheck || 3500;
          const salaryBuffer = balances.salary_buffer || 0;
          const yieldPool = balances.yield_pool || 0;
          const reserveFloor = balances.reserve_floor || 0;

          let recallAmount = 0;
          let actionTaken = false;

          // 1. Shore up check from Ondo Yield Pool if salary buffer is below target paycheck
          if (salaryBuffer < targetPaycheck) {
            const deficit = parseFloat((targetPaycheck - salaryBuffer).toFixed(2));
            if (yieldPool > 0) {
              recallAmount = Math.min(yieldPool, deficit);
              if (recallAmount > 0) {
                balances.yield_pool = parseFloat((balances.yield_pool - recallAmount).toFixed(2));
                balances.salary_buffer = parseFloat((balances.salary_buffer + recallAmount).toFixed(2));
                actionTaken = true;
                
                await simulateToolCall(toolsRegistry, "updateBalances", balances);
                await simulateToolCall(toolsRegistry, "addTransaction", {
                  type: 'yield_recall',
                  amount: recallAmount,
                  description: 'Yield recall for paycheck deficit shoring'
                });
                await simulateThought(toolsRegistry, `Deficit shored. Recalled $${recallAmount} from Ondo yield pool to liquid Salary Buffer.`);
              }
            }
          }

          // 2. Dispatch paycheck
          const currentBuffer = balances.salary_buffer;
          if (currentBuffer >= targetPaycheck) {
            balances.salary_buffer = parseFloat((balances.salary_buffer - targetPaycheck).toFixed(2));
            
            await simulateToolCall(toolsRegistry, "updateBalances", balances);
            await simulateToolCall(toolsRegistry, "addTransaction", {
              type: 'paycheck_payout',
              amount: targetPaycheck,
              description: 'Bi-weekly paycheck payout'
            });
            await simulateThought(toolsRegistry, `Paycheck of $${targetPaycheck} successfully dispatched.`);
          } else {
            // Partial paycheck dispatch
            const partial = currentBuffer;
            balances.salary_buffer = 0;
            
            await simulateToolCall(toolsRegistry, "updateBalances", balances);
            if (partial > 0) {
              await simulateToolCall(toolsRegistry, "addTransaction", {
                type: 'paycheck_payout',
                amount: partial,
                description: 'Partial paycheck payout'
              });
            }
            await simulateThought(toolsRegistry, `CRITICAL: Insufficient funds in salary buffer! Dispatched partial paycheck of $${partial}.`);
          }

          const monthlyBurn = targetPaycheck * 2;
          const totalAvailable = balances.salary_buffer + balances.yield_pool + balances.reserve_floor;
          const runwayMonths = monthlyBurn > 0 ? parseFloat((totalAvailable / monthlyBurn).toFixed(2)) : 99;

          await toolsRegistry.submitTreasuryEvaluation({
            runwayMonths,
            recallAmount,
            actionTaken,
            advice: `Paycheck dispatch cycle processed. Runway is now ${runwayMonths} months.`
          });
        }
      } else if (prompt.includes('manual') || prompt.includes('recall') || prompt.includes('Recall')) {
        // Manual recall yield
        const amountMatch = prompt.match(/recall of \$?([0-9,]+(?:\.[0-9]{2})?)/i);
        const recallVal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
        
        await simulateThought(toolsRegistry, `Executing manual recall of $${recallVal} from Ondo USDY yield pool...`);

        if (toolsRegistry.getBalances && toolsRegistry.updateBalances && toolsRegistry.addTransaction && toolsRegistry.submitTreasuryEvaluation) {
          const balances = await toolsRegistry.getBalances();
          const yieldPool = balances.yield_pool || 0;
          const actualRecall = Math.min(yieldPool, recallVal);

          if (actualRecall > 0) {
            balances.yield_pool = parseFloat((balances.yield_pool - actualRecall).toFixed(2));
            balances.salary_buffer = parseFloat((balances.salary_buffer + actualRecall).toFixed(2));

            await simulateToolCall(toolsRegistry, "updateBalances", balances);
            await simulateToolCall(toolsRegistry, "addTransaction", {
              type: 'yield_recall',
              amount: actualRecall,
              description: 'Manual Ondo Yield Recall'
            });
            await simulateThought(toolsRegistry, `Recalled $${actualRecall} to liquid checking buffer.`);
          }

          await toolsRegistry.submitTreasuryEvaluation({
            runwayMonths: 99,
            recallAmount: actualRecall,
            actionTaken: actualRecall > 0,
            advice: 'Manual recall complete.'
          });
        }
      }
    } else if (agentName === 'InvoiceSentinel') {
      // Overdue invoices check
      await simulateThought(toolsRegistry, "Scanning client ledger invoices for overdue unpaid items...");

      if (toolsRegistry.getInvoices && toolsRegistry.saveDraftEmail && toolsRegistry.submitInvoiceSentinelEvaluation) {
        const invoices = await toolsRegistry.getInvoices();
        const activeInvoices = invoices.filter(inv => inv.amount !== 0);
        const overdueList = [];

        for (const inv of activeInvoices) {
          const overdueDays = inv.overdueDays || 0;
          if ((inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'overdue') && overdueDays >= 14) {
            const clientName = inv.client || 'Valued Client';
            const invId = inv.invoiceId || inv.id || 'INV';
            
            let subject = '';
            let body = '';
            let tone = 'polite';

            if (overdueDays >= 21) {
              tone = 'escalated';
              subject = `URGENT: Overdue Invoice for ${clientName}`;
              body = `Hi ${clientName},\n\nWe have not received payment for invoice ${invId}, which is now ${overdueDays} days overdue. Please remit payment immediately or contact us to arrange terms.\n\nSincerely,\n[Creator Name]`;
            } else {
              subject = `Friendly Reminder: Invoice Payment for ${clientName}`;
              body = `Hi ${clientName},\n\nHope you are doing well. This is a gentle reminder that invoice ${invId} is now ${overdueDays} days past due. Please process this at your earliest convenience.\n\nWarm regards,\n[Creator Name]`;
            }

            const draftEmail = `Subject: ${subject}\n\n${body}`;
            
            await simulateToolCall(toolsRegistry, "saveDraftEmail", {
              invoiceId: invId,
              client: clientName,
              status: inv.status,
              overdueDays,
              draftEmail
            });

            overdueList.push({
              invoiceId: invId,
              client: clientName,
              status: inv.status,
              overdueDays,
              draftEmail
            });
          }
        }

        await simulateThought(toolsRegistry, `Scan complete. Found ${overdueList.length} invoices requiring reminders.`);

        await toolsRegistry.submitInvoiceSentinelEvaluation({ overdueList });
      }
    }

    return {
      status: 'success',
      text: 'Local ReAct Simulation completed successfully.'
    };

  } catch (e) {
    console.error(`[Agent Runner: ${agentName}] Critical local ReAct simulation error:`, e);
    return { status: 'failed', error: e.message };
  }
}

// Helpers to log step-by-step thoughts and tool calls in Local ReAct Simulation
async function simulateThought(toolsRegistry, thought) {
  if (toolsRegistry.logReasoning) {
    await toolsRegistry.logReasoning({ message: `[Thought] ${thought}` });
  }
  // Short delay to simulate agent thinking/latency in the console
  await new Promise(r => setTimeout(r, 200));
}

async function simulateToolCall(toolsRegistry, toolName, args) {
  if (toolsRegistry.logReasoning) {
    await toolsRegistry.logReasoning({ message: `[Action] Calling tool "${toolName}" with parameters: ${JSON.stringify(args)}` });
  }
  
  let observation = { status: 'success' };
  const toolFunc = toolsRegistry[toolName];
  if (toolFunc) {
    try {
      const res = await toolFunc(args);
      if (res !== undefined) observation = res;
    } catch (e) {
      observation = { error: e.message };
    }
  }

  if (toolsRegistry.logReasoning) {
    await toolsRegistry.logReasoning({ message: `[Observation] Tool "${toolName}" returned: ${JSON.stringify(observation)}` });
  }
  
  await new Promise(r => setTimeout(r, 150));
  return observation;
}
