/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ============================================================================
 * FUTURE ENGINE INSERTION POINTS — NOT IMPLEMENTED IN PHASE 1
 * ============================================================================
 *
 * This file is the SINGLE, DELIBERATE place where later phases attach to the
 * platform. Nothing here executes. Nothing here is wired into a live path.
 *
 * ARCHITECTURAL RULE (do not violate in any later phase):
 *
 *   Signal / Strategy
 *        -> strategyEngineService.evaluate()      (Phase 4)
 *        -> regimeEngineService.classify()        (Phase 3)
 *        -> riskEngineService.approve()           (Phase 2)  <-- MANDATORY GATE
 *        -> executionService.enqueue()            (Phase 5)
 *        -> MT5 Execution Bridge -> MT5 EA (Phase 6) -> Broker
 *
 * There is exactly ONE approved path from a strategy decision to an order, and
 * it runs through riskEngineService.approve(). No strategy configuration field,
 * no dashboard control, and no growth-journey value may create a second path.
 * `growth_journey` is presentation data and is never read by a sizing routine.
 *
 * PHASE 1 REALITY: the flow stops at the paper simulator —
 *   Manual test action -> paperRiskPlaceholder() -> paper trade record -> journal
 */

export type PhaseStatus = 'NOT_IMPLEMENTED' | 'PLANNED';

export interface EngineStub {
  key: string;
  label: string;
  phase: string;
  status: PhaseStatus;
  description: string;
}

export const FUTURE_ENGINES: EngineStub[] = [
  {
    key: 'riskEngineService',
    label: 'Risk Engine',
    phase: 'Phase 2',
    status: 'NOT_IMPLEMENTED',
    description:
      'Mandatory approval gate. Converts a proposed action plus a risk profile into an approved size or a rejection. Every future execution path must pass through it.',
  },
  {
    key: 'regimeEngineService',
    label: 'Regime Engine',
    phase: 'Phase 3',
    status: 'NOT_IMPLEMENTED',
    description: 'Classifies volatility, session and trend quality so strategies can stand down in hostile conditions.',
  },
  {
    key: 'historicalValidationService',
    label: 'Historical Validation / Backtesting',
    phase: 'Phase 3.5',
    status: 'NOT_IMPLEMENTED',
    description: 'Replays stored sequences against historical data. No backtesting engine exists in Phase 1.',
  },
  {
    key: 'strategyEngineService',
    label: 'Adaptive Structural Hedge Strategy Engine',
    phase: 'Phase 4',
    status: 'NOT_IMPLEMENTED',
    description: 'Turns structural analysis into proposed actions. Proposals only — it never sizes or routes an order itself.',
  },
  {
    key: 'executionService',
    label: 'MT5 Execution Bridge',
    phase: 'Phase 5',
    status: 'NOT_IMPLEMENTED',
    description: 'Queues risk-approved actions for delivery to the terminal. Not available; the UI reports NOT AVAILABLE honestly.',
  },
  {
    key: 'reconciliationService',
    label: 'Broker Reconciliation',
    phase: 'Phase 5',
    status: 'NOT_IMPLEMENTED',
    description: 'Reconciles platform records against broker tickets and deals once a bridge exists.',
  },
  {
    key: 'mt5ExpertAdvisor',
    label: 'MT5 Expert Advisor (MQL5)',
    phase: 'Phase 6',
    status: 'NOT_IMPLEMENTED',
    description: 'Terminal-side EA. No MQL5 code is part of this project yet.',
  },
  {
    key: 'signalAdapterService',
    label: 'Signal Adapters (Email / Telegram / Webhook / Discord / API)',
    phase: 'Phase 2+',
    status: 'NOT_IMPLEMENTED',
    description: 'Parsers that will normalise external signals into the signals table. Phase 1 accepts MANUAL entry only.',
  },
  {
    key: 'aiAnalysisService',
    label: 'AI Analysis',
    phase: 'Future',
    status: 'PLANNED',
    description: 'Post-trade review and narrative analysis. It will never be given order authority.',
  },
  {
    key: 'newsEngineService',
    label: 'News Engine',
    phase: 'Future',
    status: 'PLANNED',
    description: 'Feeds economic-calendar state into the Regime Engine. News trading is out of scope.',
  },
  {
    key: 'portfolioOptimizationService',
    label: 'Portfolio Optimisation',
    phase: 'Future',
    status: 'PLANNED',
    description: 'Cross-account correlation and exposure balancing across account groups.',
  },
];

export class NotImplementedInPhase1Error extends Error {
  constructor(engine: string, phase: string) {
    super(`${engine} is not implemented. Scheduled for ${phase}.`);
    this.name = 'NotImplementedInPhase1Error';
  }
}

/* -------------------------------------------------------------------------- */
/* PHASE 2 — riskEngineService                                                 */
/* -------------------------------------------------------------------------- */

export interface RiskApprovalRequest {
  accountId: string;
  symbolId: string;
  direction: 'BUY' | 'SELL';
  role: 'PRIMARY' | 'HEDGE' | 'REENTRY' | 'REDUCTION';
  hedgeTier: number;
  proposedVolume: number;
}

export interface RiskApprovalResult {
  approved: boolean;
  approvedVolume: number;
  reasons: string[];
}

/**
 * PHASE 2 INSERTION POINT — the one and only sizing authority.
 * Deliberately throws so that no caller can accidentally treat an unimplemented
 * engine as an approval.
 */
export async function riskEngineApprove(_request: RiskApprovalRequest): Promise<RiskApprovalResult> {
  throw new NotImplementedInPhase1Error('riskEngineService.approve()', 'Phase 2');
}

/* -------------------------------------------------------------------------- */
/* PHASE 3 / 4 / 5 stubs                                                       */
/* -------------------------------------------------------------------------- */

export async function regimeEngineClassify(_symbolId: string): Promise<never> {
  throw new NotImplementedInPhase1Error('regimeEngineService.classify()', 'Phase 3');
}

export async function strategyEngineEvaluate(_strategyId: string): Promise<never> {
  throw new NotImplementedInPhase1Error('strategyEngineService.evaluate()', 'Phase 4');
}

export async function executionEnqueue(_approved: RiskApprovalResult): Promise<never> {
  throw new NotImplementedInPhase1Error('executionService.enqueue()', 'Phase 5');
}

export async function reconciliationRun(_accountId: string): Promise<never> {
  throw new NotImplementedInPhase1Error('reconciliationService.run()', 'Phase 5');
}

export async function signalAdapterIngest(_source: string, _payload: unknown): Promise<never> {
  throw new NotImplementedInPhase1Error('signalAdapterService.ingest()', 'Phase 2+');
}

/* -------------------------------------------------------------------------- */
/* PHASE 1 — paper risk placeholder                                            */
/* -------------------------------------------------------------------------- */

export interface PaperRiskCheck {
  allowed: boolean;
  code: 'OK' | 'HEDGE_TIER_LIMIT' | 'PAPER_DISABLED' | 'HEDGING_NOT_ALLOWED' | 'VOLUME_INVALID';
  message: string;
}

/**
 * Paper-only guard rails. This is NOT the Risk Engine and never becomes it.
 * It enforces only the hard safety limits the simulator needs:
 *   - the configured max_hedge_tiers is never exceeded,
 *   - volume stays within the symbol's own bounds,
 *   - paper trading can be paused.
 * It performs NO position sizing, applies NO multiplier, and contains no
 * martingale, doubling or averaging behaviour of any kind.
 */
export function paperRiskPlaceholder(input: {
  paperEnabled: boolean;
  hedgingAllowed: boolean;
  isHedge: boolean;
  requestedTier: number;
  maxHedgeTiers: number;
  volume: number;
  minVolume: number;
  maxVolume: number;
}): PaperRiskCheck {
  if (!input.paperEnabled) {
    return { allowed: false, code: 'PAPER_DISABLED', message: 'PAPER TRADING PAUSED for this account.' };
  }
  if (input.volume < input.minVolume || input.volume > input.maxVolume) {
    return {
      allowed: false,
      code: 'VOLUME_INVALID',
      message: `Simulated volume must be between ${input.minVolume} and ${input.maxVolume} lots.`,
    };
  }
  if (input.isHedge) {
    if (!input.hedgingAllowed) {
      return { allowed: false, code: 'HEDGING_NOT_ALLOWED', message: 'HEDGING DISABLED on this account.' };
    }
    if (input.requestedTier > input.maxHedgeTiers) {
      return {
        allowed: false,
        code: 'HEDGE_TIER_LIMIT',
        message: `HEDGE TIER LIMIT REACHED — the assigned risk profile permits a maximum of ${input.maxHedgeTiers} hedge tier(s).`,
      };
    }
  }
  return { allowed: true, code: 'OK', message: 'Simulated action permitted by paper guard rails.' };
}
