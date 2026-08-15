/**
 * Phase 1 domain types — mirror the database schema exactly.
 *
 * Every numeric value produced by this platform in Phase 1 is SIMULATED.
 * No type in this file represents a real broker fill, real balance or
 * real market price.
 */

export type Role = 'owner' | 'admin' | 'viewer';

export type AccountMode = 'AUTONOMOUS' | 'SIGNALCOPY' | 'HYBRID' | 'ASSISTED' | 'MONITORONLY';
export type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type ExecutionStatus = 'NOT_CONNECTED' | 'READY' | 'OFFLINE' | 'ERROR';
export type RiskState = 'NORMAL' | 'WATCH' | 'THROTTLED' | 'LOCKED';
export type Direction = 'BUY' | 'SELL';

export type StrategyType =
  | 'STRUCTURAL_HEDGE' | 'NEWS_HEDGE' | 'TREND' | 'BREAKOUT'
  | 'MEAN_REVERSION' | 'SIGNAL_COPY' | 'HYBRID' | 'CUSTOM';
export type StrategyStatus = 'DRAFT' | 'TESTING' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export type SignalSource =
  | 'EMAIL' | 'TELEGRAM' | 'WEBHOOK' | 'API' | 'DISCORD' | 'MANUAL' | 'BROKER' | 'INTERNAL';
export type SignalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';

export type SequenceState =
  | 'NORMAL' | 'WATCH' | 'HEDGETRIGGERED' | 'HEDGED' | 'CONFIRMING'
  | 'REDUCEPRIMARY' | 'FOLLOWHEDGE' | 'RECOVERYCOMPLETE' | 'EMERGENCY' | 'CLOSED';

export type TradeRole = 'PRIMARY' | 'HEDGE' | 'REENTRY' | 'REDUCTION' | 'EMERGENCY';
export type TradeStatus = 'PLANNED' | 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED' | 'CANCELLED' | 'FAILED';
export type TradeExecutionStatus = 'PAPER' | 'NOT_CONNECTED' | 'PENDING' | 'FILLED' | 'FAILED';
export type HedgeStatus = 'PLANNED' | 'ACTIVE' | 'REDUCED' | 'CLOSED' | 'CANCELLED';
export type Severity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface Profile {
  id: string;
  workspace_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Symbol {
  id: string;
  workspace_id: string | null;
  broker_symbol: string;
  display_name: string;
  asset_class: string;
  base_asset: string | null;
  quote_asset: string | null;
  digits: number;
  contract_size: number;
  min_volume: number;
  max_volume: number;
  volume_step: number;
  pip_value_per_lot: number;
  status: RecordStatus;
}

export interface RiskProfile {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  risk_per_setup: number;
  risk_per_hedge: number;
  max_daily_loss: number;
  max_weekly_drawdown: number;
  max_monthly_drawdown: number;
  max_open_positions: number;
  max_hedge_tiers: number;
  max_total_exposure: number;
  max_correlated_exposure: number;
  max_margin_utilization: number;
  news_mode: 'BLOCK' | 'REDUCE' | 'ALLOW';
  trading_enabled: boolean;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface TradingAccount {
  id: string;
  workspace_id: string;
  name: string;
  broker: string | null;
  server: string | null;
  account_reference: string | null;
  account_mode: AccountMode;
  currency: string;
  leverage: number;
  margin_mode: 'NETTING' | 'HEDGING';
  hedging_allowed: boolean;
  status: RecordStatus;
  trading_enabled: boolean;
  risk_profile_id: string | null;
  current_risk_state: RiskState;
  manual_stop_active: boolean;
  execution_status: ExecutionStatus;
  mt5_account_number: string | null;
  last_execution_heartbeat_at: string | null;
  execution_mode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountGroup {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface AccountGroupMember {
  id: string;
  workspace_id: string;
  group_id: string;
  account_id: string;
  risk_multiplier: number;
  created_at: string;
}

export type RuleBlock = Record<string, unknown>;

export interface Strategy {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  strategy_type: StrategyType;
  version: string;
  status: StrategyStatus;
  entry_rules: RuleBlock;
  exit_rules: RuleBlock;
  hedge_rules: RuleBlock;
  regime_rules: RuleBlock;
  risk_rules: RuleBlock;
  created_at: string;
  updated_at: string;
}

export interface StrategyAssignment {
  id: string;
  workspace_id: string;
  account_id: string;
  strategy_id: string;
  enabled: boolean;
  priority: number;
  configuration_override: RuleBlock;
  created_at: string;
  updated_at: string;
}

export interface Signal {
  id: string;
  workspace_id: string;
  source_type: SignalSource;
  source_name: string | null;
  raw_signal: RuleBlock;
  symbol_id: string | null;
  direction: Direction | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  timeframe: string | null;
  provider_reference: string | null;
  validation_status: SignalStatus;
  bot_confidence: number | null;
  notes: string | null;
  received_at: string;
  created_at: string;
}

export interface TradeSequence {
  id: string;
  workspace_id: string;
  reference: string | null;
  account_id: string;
  strategy_id: string | null;
  symbol_id: string;
  signal_id: string | null;
  direction: Direction;
  state: SequenceState;
  current_hedge_tier: number;
  initial_risk: number;
  current_exposure: number;
  realized_pnl: number;
  floating_pnl: number;
  max_sequence_exposure: number | null;
  total_risk_allocated: number | null;
  emergency_flag: boolean;
  is_simulated: boolean;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  workspace_id: string;
  sequence_id: string;
  account_id: string;
  strategy_id: string | null;
  signal_id: string | null;
  symbol_id: string;
  side: Direction;
  trade_role: TradeRole;
  status: TradeStatus;
  volume: number;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  realized_pnl: number;
  floating_pnl: number;
  risk_amount: number;
  hedge_tier: number;
  opened_at: string | null;
  closed_at: string | null;
  client_order_id: string | null;
  broker_ticket: string | null;
  broker_deal_id: string | null;
  broker_order_id: string | null;
  execution_status: TradeExecutionStatus;
  last_synced_at: string | null;
  metadata: RuleBlock;
  created_at: string;
  updated_at: string;
}

export interface HedgeRecord {
  id: string;
  workspace_id: string;
  sequence_id: string;
  parent_trade_id: string | null;
  hedge_trade_id: string | null;
  hedge_tier: number;
  trigger_reason: string;
  hedge_direction: Direction;
  hedge_volume: number;
  hedge_entry_price: number | null;
  hedge_status: HedgeStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_pnl: number;
  notes: string | null;
  metadata: RuleBlock;
  created_at: string;
  updated_at: string;
}

export interface PaperAccount {
  id: string;
  workspace_id: string;
  trading_account_id: string;
  starting_balance: number;
  current_balance: number;
  current_equity: number;
  simulated_pnl: number;
  paper_trading_enabled: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface PaperPosition {
  id: string;
  workspace_id: string;
  paper_account_id: string;
  sequence_id: string | null;
  trade_id: string | null;
  symbol_id: string;
  side: Direction;
  position_role: 'PRIMARY' | 'HEDGE' | 'REENTRY' | 'REDUCTION';
  hedge_tier: number;
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  unrealized_pnl: number;
  realized_pnl: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperDecisionLogEntry {
  id: string;
  workspace_id: string;
  paper_account_id: string | null;
  account_id: string | null;
  strategy_id: string | null;
  symbol_id: string | null;
  origin: 'MANUAL_USER_ACTION' | 'SIMULATION';
  action: string;
  reason: string | null;
  result: string | null;
  created_at: string;
}

export interface SystemEvent {
  id: string;
  workspace_id: string;
  user_id: string | null;
  account_id: string | null;
  event_type: string;
  severity: Severity;
  message: string;
  metadata: RuleBlock;
  created_at: string;
}

export interface GrowthJourney {
  id: string;
  workspace_id: string;
  starting_balance: number;
  current_level: number;
  target_level: number;
  target_balance: number;
  actual_balance: number;
  pace: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'PAUSED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  id: string;
  workspace_id: string;
  setting_key: string;
  setting_value: RuleBlock;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ACCOUNT_MODES: AccountMode[] = ['AUTONOMOUS', 'SIGNALCOPY', 'HYBRID', 'ASSISTED', 'MONITORONLY'];
export const STRATEGY_TYPES: StrategyType[] = ['STRUCTURAL_HEDGE', 'NEWS_HEDGE', 'TREND', 'BREAKOUT', 'MEAN_REVERSION', 'SIGNAL_COPY', 'HYBRID', 'CUSTOM'];
export const STRATEGY_STATUSES: StrategyStatus[] = ['DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
export const SIGNAL_SOURCES: SignalSource[] = ['MANUAL', 'EMAIL', 'TELEGRAM', 'WEBHOOK', 'API', 'DISCORD', 'BROKER', 'INTERNAL'];
export const SIGNAL_STATUSES: SignalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED'];
export const SEQUENCE_STATES: SequenceState[] = ['NORMAL', 'WATCH', 'HEDGETRIGGERED', 'HEDGED', 'CONFIRMING', 'REDUCEPRIMARY', 'FOLLOWHEDGE', 'RECOVERYCOMPLETE', 'EMERGENCY', 'CLOSED'];
export const TRADE_ROLES: TradeRole[] = ['PRIMARY', 'HEDGE', 'REENTRY', 'REDUCTION', 'EMERGENCY'];
export const TRADE_STATUSES: TradeStatus[] = ['PLANNED', 'OPEN', 'PARTIALLY_CLOSED', 'CLOSED', 'CANCELLED', 'FAILED'];

/** Signal sources that actually have an adapter in Phase 1. Everything else is future work. */
export const PHASE1_ENABLED_SIGNAL_SOURCES: SignalSource[] = ['MANUAL'];
