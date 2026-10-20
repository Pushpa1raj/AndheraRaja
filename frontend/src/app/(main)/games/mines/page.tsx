'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { MinesSession, CreditAccount } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Bomb,
  Coins,
  ShieldCheck,
  Sparkles,
  Gem,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'

export default function MinesPage() {
  const [balance, setBalance] = useState<number>(1000)
  const [session, setSession] = useState<MinesSession | null>(null)
  const [wagerAmount, setWagerAmount] = useState<number>(50)
  const [mineCount, setMineCount] = useState<number>(3)
  const [revealingIndex, setRevealingIndex] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const gridSize = 5
  const totalCells = gridSize * gridSize

  const fetchBalance = useCallback(async () => {
    try {
      const acc = await apiClient.get<CreditAccount>('/api/v1/credits/balance').catch(() => null)
      if (acc && typeof acc.balance === 'number') {
        setBalance(acc.balance)
      }
    } catch {
      // Fallback
    }
  }, [])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Calculate theoretical next tile multiplier preview
  const getTheoreticalMultiplier = (reveals: number, mines: number) => {
    let mult = 1.0
    for (let i = 0; i < reveals; i++) {
      mult *= (totalCells - i) / (totalCells - mines - i)
    }
    // 1% platform commission
    return parseFloat((mult * 0.99).toFixed(2))
  }

  // Start new Mines session
  const handleStartGame = async () => {
    if (isStarting || wagerAmount <= 0 || wagerAmount > balance) return
    setIsStarting(true)
    setStatusMessage(null)

    try {
      const clientNonce = Math.random().toString(36).substring(2, 12)
      const newSession = await apiClient.post<MinesSession>('/api/v1/games/mines/sessions', {
        wager_amount: wagerAmount,
        grid_size: gridSize,
        mine_count: mineCount,
        client_nonce: clientNonce,
      })

      setSession(newSession)
      setBalance((prev) => Math.max(0, prev - wagerAmount))
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start Mines game'
      setStatusMessage(msg)
    } finally {
      setIsStarting(false)
    }
  }

  // Reveal a tile
  const handleRevealTile = async (index: number) => {
    if (!session || session.status !== 'running' || revealingIndex !== null) return
    if (session.revealed_cells.includes(index)) return

    setRevealingIndex(index)
    try {
      const updated = await apiClient.post<MinesSession>(`/api/v1/games/mines/sessions/${session.id}/reveal`, {
        cell_index: index,
      })

      setSession(updated)

      if (updated.status === 'lost') {
        setStatusMessage('Boom! You hit a mine. Better luck next round!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tile reveal failed'
      setStatusMessage(msg)
    } finally {
      setRevealingIndex(null)
    }
  }

  // Cash out active session
  const handleCashOut = async () => {
    if (!session || session.status !== 'running' || isCashingOut || session.revealed_cells.length === 0) return

    setIsCashingOut(true)
    try {
      const updated = await apiClient.post<MinesSession>(`/api/v1/games/mines/sessions/${session.id}/cashout`)
      setSession(updated)
      const wonAmount = updated.payout_amount || Math.floor((session.wager_amount * session.current_multiplier_bps) / 10000)
      setBalance((prev) => prev + wonAmount)
      setStatusMessage(`Victory! Cashed out +${wonAmount.toLocaleString()} Virtual Credits!`)
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cash out failed'
      setStatusMessage(msg)
    } finally {
      setIsCashingOut(false)
    }
  }

  const isGameOver = session?.status === 'lost' || session?.status === 'cashed_out'
  const currentMultiplier = session ? (session.current_multiplier_bps / 10000).toFixed(2) : '1.00'
  const nextMultiplier = session
    ? getTheoreticalMultiplier(session.revealed_cells.length + 1, session.mine_count)
    : getTheoreticalMultiplier(1, mineCount)

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0F1420] p-3.5 sm:p-4 rounded-2xl border border-[#1F293D]">
        <div className="flex items-center gap-3">
          <Link href="/games">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Lobby
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bomb className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
              Mines <span className="text-emerald-400 text-xs font-semibold normal-case">Provably Fair</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-xs text-gray-400 flex items-center gap-1.5 bg-[#141A27] px-3 py-1.5 rounded-xl border border-[#1F293D]">
            <Coins className="w-3.5 h-3.5 text-[#E5B842]" />
            <span>Balance: <strong className="text-white">{balance.toLocaleString()}</strong></span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFairness(!showFairness)}
            className="text-gray-400 hover:text-[#E5B842] h-8 px-2 text-xs flex items-center gap-1"
            title="Provably Fair Proof"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Fairness Proof</span>
          </Button>
        </div>
      </div>

      {/* Fairness Commitment Drawer */}
      {showFairness && (
        <div className="p-4 rounded-xl bg-[#090C12] border border-emerald-500/30 text-xs space-y-2 text-gray-300 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Cryptographic Seed Verification
            </span>
            {session && <span className="text-gray-500 font-mono text-[10px]">Session #{session.id.slice(0, 8)}</span>}
          </div>
          <p className="text-gray-400">
            Mine locations are determined deterministically using HMAC-SHA256 based on the committed server seed and your client nonce. The grid cannot be altered mid-game.
          </p>
          {session ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px] pt-1">
              <div className="bg-[#121723] p-2 rounded border border-[#1F293D] truncate">
                <span className="text-gray-500 block text-[9px] uppercase">Committed Server Seed Hash</span>
                <span className="text-emerald-400">{session.server_seed_hash}</span>
              </div>
              <div className="bg-[#121723] p-2 rounded border border-[#1F293D] truncate">
                <span className="text-gray-500 block text-[9px] uppercase">Revealed Server Seed (Post-Game)</span>
                <span className="text-[#E5B842]">{session.revealed_server_seed || 'Hidden until round settles'}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">Start a session to inspect its live commitment hash.</p>
          )}
        </div>
      )}

      {/* Status banner if any */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-between animate-in fade-in ${
            session?.status === 'cashed_out'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : session?.status === 'lost'
              ? 'bg-red-500/15 border-red-500/40 text-red-400'
              : 'bg-[#182030] border-[#E5B842]/30 text-white'
          }`}
        >
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* Main Game Interface: Grid + Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* 5x5 Mines Grid Area (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-[#090C12] p-4 sm:p-6 rounded-2xl border border-[#1F293D] shadow-2xl flex flex-col items-center justify-center">
          {/* Grid Stats Bar */}
          <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-[#182030] text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Gem className="w-3.5 h-3.5 text-emerald-400" />
              Safe Gems: <strong className="text-white">{session ? session.revealed_cells.length : 0}</strong> / {totalCells - (session?.mine_count || mineCount)}
            </span>
            <span className="text-gray-400 flex items-center gap-1.5">
              <Bomb className="w-3.5 h-3.5 text-red-400" />
              Mines: <strong className="text-white">{session?.mine_count || mineCount}</strong>
            </span>
          </div>

          {/* 5x5 Grid */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-[420px] aspect-square">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const isRevealed = session?.revealed_cells.includes(idx)
              const isMinePosition = session?.revealed_mine_positions?.includes(idx)
              const isBeingRevealed = revealingIndex === idx
              const canClick = session?.status === 'running' && !isRevealed && revealingIndex === null

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRevealTile(idx)}
                  disabled={!canClick}
                  className={`relative rounded-xl font-bold flex items-center justify-center transition-all duration-200 select-none ${
                    isRevealed
                      ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400 text-emerald-400 shadow-md shadow-emerald-500/20 tile-reveal'
                      : isMinePosition && isGameOver
                      ? 'bg-red-500/20 border-2 border-red-500/60 text-red-500 tile-reveal'
                      : canClick
                      ? 'bg-[#151B28] hover:bg-[#1D2537] border border-[#2A354C] hover:border-[#E5B842]/50 hover:scale-[1.03] active:scale-[0.97] cursor-pointer shadow-sm'
                      : 'bg-[#121723] border border-[#1A2234] opacity-70 cursor-not-allowed'
                  }`}
                  aria-label={`Tile ${idx + 1}`}
                >
                  {isBeingRevealed ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#E5B842] border-t-transparent animate-spin" />
                  ) : isRevealed ? (
                    <Gem className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-in zoom-in-50" />
                  ) : isMinePosition && isGameOver ? (
                    <Bomb className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-in zoom-in-50" />
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Quick instructions under grid */}
          <div className="pt-4 text-center text-[11px] text-gray-500">
            {session?.status === 'running'
              ? 'Click unrevealed tiles to unearth safe gems and multiply your credits!'
              : 'Configure your wager and mines count, then start the round.'}
          </div>
        </div>

        {/* Control Panel (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-xl space-y-4">
            {/* Live Multiplier Display */}
            <div className="p-4 rounded-xl bg-[#090C12] border border-[#1F293D] text-center space-y-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold block">
                {session?.status === 'running' ? 'Active Multiplier' : 'Next Tile Multiplier'}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-white gold-gradient-text">
                {session?.status === 'running' ? `${currentMultiplier}x` : `${nextMultiplier}x`}
              </span>
              {session?.status === 'running' && (
                <span className="text-xs font-semibold text-emerald-400 block">
                  Cashout Value: +{Math.floor((session.wager_amount * session.current_multiplier_bps) / 10000).toLocaleString()} Credits
                </span>
              )}
            </div>

            {/* Wager Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span className="font-semibold text-gray-300">Wager Amount (Credits)</span>
                <span>Max: <strong className="text-[#E5B842]">{balance.toLocaleString()}</strong></span>
              </div>
              <Input
                type="number"
                min={10}
                max={balance}
                value={wagerAmount}
                onChange={(e) => setWagerAmount(Math.max(1, parseInt(e.target.value) || 0))}
                disabled={session?.status === 'running'}
                className="bg-[#141A27] border-[#222C42] text-white font-bold h-11"
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[10, 50, 100, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWagerAmount(amt)}
                    disabled={session?.status === 'running'}
                    className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${
                      wagerAmount === amt
                        ? 'bg-[#E5B842]/20 border-[#E5B842] text-[#E5B842]'
                        : 'bg-[#141A27] border-[#222C42] text-gray-400 hover:text-white'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Mines Count Selector */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span className="font-semibold text-gray-300">Number of Mines (1–24)</span>
                <span className="text-red-400 font-bold">{mineCount} Hidden Mines</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 3, 5, 10, 20].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={mineCount === m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMineCount(m)}
                    disabled={session?.status === 'running'}
                    className={`h-9 font-bold text-xs ${
                      mineCount === m
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                        : 'border-[#222C42] text-gray-300 hover:text-white hover:bg-[#182030]'
                    }`}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Start or Cashout */}
            <div className="pt-2">
              {session?.status === 'running' ? (
                <Button
                  onClick={handleCashOut}
                  disabled={isCashingOut || session.revealed_cells.length === 0}
                  className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-[#0B0E14] font-black text-lg shadow-lg shadow-emerald-500/20 flex flex-col items-center justify-center animate-pulse"
                >
                  <span>CASH OUT (+{Math.floor((session.wager_amount * session.current_multiplier_bps) / 10000).toLocaleString()})</span>
                  <span className="text-[11px] font-bold text-[#0B0E14]/80">
                    Lock in {currentMultiplier}x Multiplier
                  </span>
                </Button>
              ) : isGameOver ? (
                <Button
                  onClick={handleStartGame}
                  disabled={isStarting || wagerAmount > balance}
                  className="w-full h-14 rounded-xl gold-button font-black text-base shadow-lg shadow-[#E5B842]/20 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>PLAY AGAIN ({wagerAmount} Credits)</span>
                </Button>
              ) : (
                <Button
                  onClick={handleStartGame}
                  disabled={isStarting || wagerAmount > balance || wagerAmount <= 0}
                  className="w-full h-14 rounded-xl gold-button font-black text-base shadow-lg shadow-[#E5B842]/20 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>START GAME ({wagerAmount} Credits)</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
