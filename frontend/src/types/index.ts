export interface Game {
  id: string
  type: 'aviator' | 'mines'
  name: string
  status: 'active' | 'disabled' | 'maintenance'
  description: string
  current_config_version: number
  created_at: string
  updated_at: string
}

export interface CreditAccount {
  user_id: string
  balance: number
  lifetime_earned: number
  lifetime_spent: number
  last_transaction_at: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  type: 'admin_allocation' | 'game_wager' | 'game_payout' | 'adjustment'
  amount: number
  balance_after: number
  reference_type: string | null
  reference_id: string | null
  reason: string | null
  created_at: string
}

export interface CreditRequest {
  id: string
  user_id: string
  requested_amount: number
  message: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'partially_approved'
  approved_amount: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  admin_note: string | null
  created_at: string
}

export interface AviatorRound {
  id: string
  game_id: string
  configuration_id: string
  status: 'waiting' | 'running' | 'crashed' | 'cancelled' | 'completed'
  starts_at: string
  betting_closes_at: string
  crash_at: string
  server_seed_hash: string
  client_nonce: string
  fairness_algorithm: string
  crash_multiplier_bps: number
  revealed_server_seed: string | null
  cancellation_reason: string | null
  settled_at: string | null
}

export interface AviatorBet {
  id: string
  round_id: string
  user_id: string
  wager_amount: number
  status: 'placed' | 'cashed_out' | 'lost' | 'cancelled'
  cashout_multiplier_bps: number | null
  payout_amount: number | null
  created_at: string
  settled_at: string | null
}

export interface MinesSession {
  id: string
  game_id: string
  user_id: string
  configuration_id: string
  status: 'running' | 'cashed_out' | 'lost' | 'cancelled'
  wager_amount: number
  grid_size: number
  mine_count: number
  server_seed_hash: string
  client_nonce: string
  fairness_algorithm: string
  revealed_cells: number[]
  event_sequence: number
  current_multiplier_bps: number
  payout_amount: number | null
  revealed_server_seed: string | null
  revealed_mine_positions: number[] | null
  created_at: string
  settled_at: string | null
}

export interface User {
  id: string
  email: string
  username: string
  role: 'user' | 'admin'
  status: 'active' | 'suspended' | 'banned'
  created_at: string
  updated_at: string
}
