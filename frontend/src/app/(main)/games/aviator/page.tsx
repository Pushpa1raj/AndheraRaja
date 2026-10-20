'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { AviatorRound, AviatorBet, CreditAccount } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  TrendingUp,
  Coins,
  ShieldCheck,
  Zap,
  Users,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'

interface SimulatedPlayerBet {
  id: string
  name: string
  amount: number
  cashedOutAt: number | null
  payout: number | null
}

export default function AviatorPage() {
  const [round, setRound] = useState<AviatorRound | null>(null)
  const [balance, setBalance] = useState<number>(1000)
  const [wagerAmount, setWagerAmount] = useState<number>(50)
  const [currentBet, setCurrentBet] = useState<AviatorBet | null>(null)
  const [multiplier, setMultiplier] = useState<number>(1.0)
  const [status, setStatus] = useState<'waiting' | 'running' | 'crashed'>('waiting')
  const [countdown, setCountdown] = useState<number>(5.0)
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [crashedAtMultiplier, setCrashedAtMultiplier] = useState<number | null>(null)
  const [recentCrashes, setRecentCrashes] = useState<number[]>([1.84, 3.25, 1.21, 14.52, 2.10, 1.45, 5.80])
  const [showFairness, setShowFairness] = useState(false)
  const [otherPlayers, setOtherPlayers] = useState<SimulatedPlayerBet[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const crashTimeRef = useRef<number>(0)

  // Fetch balance and active round
  const fetchGameState = useCallback(async () => {
    try {
      const [acc, currentRound] = await Promise.all([
        apiClient.get<CreditAccount>('/api/v1/credits/balance').catch(() => null),
        apiClient.get<AviatorRound>('/api/v1/games/aviator/rounds/current').catch(() => null),
      ])

      if (acc && typeof acc.balance === 'number') {
        setBalance(acc.balance)
      }

      if (currentRound) {
        setRound(currentRound)
      }
    } catch (err) {
      console.error('Failed to sync Aviator round:', err)
    }
  }, [])

  useEffect(() => {
    fetchGameState()
    const interval = setInterval(fetchGameState, 4000)
    return () => clearInterval(interval)
  }, [fetchGameState])

  // Generate simulated players when round changes
  useEffect(() => {
    const names = ['Rohan_K', 'Aarav99', 'Vikram_G', 'LuckyStreak', 'CryptoKing', 'Priya_M', 'Rajesh_88']
    const players: SimulatedPlayerBet[] = names.map((name, i) => ({
      id: `p-${i}`,
      name,
      amount: [20, 50, 100, 250, 500][i % 5],
      cashedOutAt: null,
      payout: null,
    }))
    setOtherPlayers(players)
  }, [round?.id])

  // Flight simulation loop
  useEffect(() => {
    if (!round) return

    const now = Date.now()
    const startsAt = new Date(round.starts_at).getTime()
    const crashAt = new Date(round.crash_at).getTime()
    const crashMultiplier = (round.crash_multiplier_bps || 20000) / 10000.0

    if (now < startsAt) {
      // WAITING PHASE
      setStatus('waiting')
      setMultiplier(1.0)
      setCrashedAtMultiplier(null)
      const timeLeft = Math.max(0, (startsAt - now) / 1000)
      setCountdown(timeLeft)
    } else if (now >= startsAt && now < crashAt) {
      // RUNNING PHASE
      setStatus('running')
      startTimeRef.current = startsAt
      crashTimeRef.current = crashAt

      const elapsed = (now - startsAt) / 1000.0
      const currentMult = Math.min(crashMultiplier, 1.0 + 0.08 * elapsed + 0.012 * Math.pow(elapsed, 2))
      setMultiplier(parseFloat(currentMult.toFixed(2)))

      // Randomly cash out simulated players
      setOtherPlayers((prev) =>
        prev.map((p) => {
          if (!p.cashedOutAt && currentMult > 1.3 && Math.random() < 0.04) {
            return {
              ...p,
              cashedOutAt: parseFloat(currentMult.toFixed(2)),
              payout: Math.floor(p.amount * currentMult),
            }
          }
          return p
        })
      )
    } else {
      // CRASHED PHASE
      setStatus('crashed')
      setCrashedAtMultiplier(crashMultiplier)
      setMultiplier(crashMultiplier)

      // Add to recent crashes if not already there
      setRecentCrashes((prev) => {
        if (prev[0] !== crashMultiplier) {
          return [crashMultiplier, ...prev.slice(0, 9)]
        }
        return prev
      })

      // Reset bet after crash settled
      if (currentBet && currentBet.status === 'placed') {
        setCurrentBet(null)
      }
    }
  }, [round])

  // Canvas Airplane & Trail Animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const render = () => {
      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)

      // Grid background
      ctx.strokeStyle = '#182030'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      if (status === 'running') {
        const progress = Math.min(1.0, (multiplier - 1.0) / 6.0)
        const planeX = 40 + progress * (width - 120)
        const planeY = height - 40 - progress * (height - 90)

        // Draw glowing golden flight curve
        ctx.beginPath()
        ctx.moveTo(40, height - 40)
        ctx.quadraticCurveTo(width * 0.4, height - 40, planeX, planeY)
        ctx.strokeStyle = '#E5B842'
        ctx.lineWidth = 4
        ctx.shadowColor = '#E5B842'
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.shadowBlur = 0

        // Fill area under curve with soft gold gradient
        ctx.lineTo(planeX, height - 40)
        ctx.lineTo(40, height - 40)
        const grad = ctx.createLinearGradient(0, planeY, 0, height - 40)
        grad.addColorStop(0, 'rgba(229, 184, 66, 0.25)')
        grad.addColorStop(1, 'rgba(229, 184, 66, 0.0)')
        ctx.fillStyle = grad
        ctx.fill()

        // Draw Stylized Jet / Airplane
        ctx.save()
        ctx.translate(planeX, planeY)
        ctx.rotate(-0.35)

        // Jet Body
        ctx.fillStyle = '#E5B842'
        ctx.beginPath()
        ctx.moveTo(18, 0)
        ctx.lineTo(-14, -8)
        ctx.lineTo(-8, 0)
        ctx.lineTo(-14, 8)
        ctx.closePath()
        ctx.fill()

        // Jet Cockpit Glow
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(6, 0, 3, 0, Math.PI * 2)
        ctx.fill()

        // Thrust flame
        ctx.fillStyle = '#F59E0B'
        ctx.beginPath()
        ctx.moveTo(-10, -3)
        ctx.lineTo(-20 - Math.random() * 8, 0)
        ctx.lineTo(-10, 3)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
      } else if (status === 'crashed') {
        // Red crash marker
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
        ctx.fillRect(0, 0, width, height)
      }

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animationId)
  }, [status, multiplier])

  // Handle Bet Placement
  const handlePlaceBet = async () => {
    if (!round || isPlacingBet || wagerAmount <= 0 || wagerAmount > balance) return

    setIsPlacingBet(true)
    try {
      const res = await apiClient.post<AviatorBet>(`/api/v1/games/aviator/rounds/${round.id}/bets`, {
        wager_amount: wagerAmount,
      })
      setCurrentBet(res)
      setBalance((prev) => Math.max(0, prev - wagerAmount))
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to place bet'
      alert(errorMsg)
    } finally {
      setIsPlacingBet(false)
    }
  }

  // Handle Cash Out
  const handleCashOut = async () => {
    if (!currentBet || isCashingOut || currentBet.status !== 'placed') return

    setIsCashingOut(true)
    try {
      const res = await apiClient.post<AviatorBet>(`/api/v1/games/aviator/bets/${currentBet.id}/cashout`)
      setCurrentBet(res)
      const wonAmount = res.payout_amount || Math.floor(currentBet.wager_amount * multiplier)
      setBalance((prev) => prev + wonAmount)
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Cash out failed'
      alert(errorMsg)
    } finally {
      setIsCashingOut(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
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
            <div className="w-7 h-7 rounded-lg bg-[#E5B842]/20 flex items-center justify-center text-[#E5B842]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
              Aviator <span className="text-[#E5B842] text-xs font-semibold normal-case">Multiplayer</span>
            </h1>
          </div>
        </div>

        {/* Recent Crashes Multipliers Pill Ticker */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold mr-1 flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> History:
          </span>
          {recentCrashes.map((val, idx) => (
            <span
              key={idx}
              className={`text-xs font-black px-2 py-0.5 rounded-md border ${
                val >= 2.0
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#182030] text-[#E5B842] border-[#E5B842]/20'
              }`}
            >
              {val.toFixed(2)}x
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFairness(!showFairness)}
            className="text-gray-400 hover:text-[#E5B842] h-6 px-1.5 text-xs"
            title="Provably Fair Proof"
          >
            <ShieldCheck className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Provably Fair Info Box */}
      {showFairness && round && (
        <div className="p-4 rounded-xl bg-[#090C12] border border-[#E5B842]/40 text-xs space-y-2 text-gray-300 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#E5B842] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Provably Fair Round Commitment
            </span>
            <span className="text-gray-500 font-mono text-[10px]">Round #{round.id.slice(0, 8)}</span>
          </div>
          <p className="text-gray-400">
            This round outcome was cryptographically committed BEFORE any wagers were placed using SHA-256 and HMAC. The server cannot alter the crash multiplier.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px] pt-1">
            <div className="bg-[#121723] p-2 rounded border border-[#1F293D] truncate">
              <span className="text-gray-500 block text-[9px] uppercase">Committed Server Seed Hash</span>
              <span className="text-[#E5B842]">{round.server_seed_hash}</span>
            </div>
            <div className="bg-[#121723] p-2 rounded border border-[#1F293D] truncate">
              <span className="text-gray-500 block text-[9px] uppercase">Client Nonce</span>
              <span className="text-blue-400">{round.client_nonce}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Screen & Side Bets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Main Canvas Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative h-64 sm:h-96 rounded-2xl bg-[#090C12] border border-[#1F293D] overflow-hidden flex flex-col justify-center items-center shadow-2xl">
            {/* Background Canvas */}
            <canvas ref={canvasRef} width={800} height={380} className="absolute inset-0 w-full h-full" />

            {/* State Overlays */}
            {status === 'waiting' && (
              <div className="relative z-10 flex flex-col items-center gap-2 text-center p-4">
                <div className="w-12 h-12 rounded-full border-2 border-[#E5B842] border-t-transparent animate-spin flex items-center justify-center mb-1" />
                <span className="text-xs uppercase font-bold text-[#E5B842] tracking-widest">
                  NEXT FLIGHT PREPARING
                </span>
                <span className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  STARTS IN {countdown > 0 ? countdown.toFixed(1) : '0.0'}s
                </span>
                <span className="text-xs text-gray-400">Place your virtual bets now</span>
              </div>
            )}

            {status === 'running' && (
              <div className="relative z-10 flex flex-col items-center select-none pointer-events-none">
                <span className="text-5xl sm:text-7xl font-black gold-gradient-text tracking-tight drop-shadow-md">
                  {multiplier.toFixed(2)}x
                </span>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mt-1">
                  CURRENT MULTIPLIER
                </span>
              </div>
            )}

            {status === 'crashed' && (
              <div className="relative z-10 flex flex-col items-center text-center p-4 animate-in zoom-in-95">
                <span className="text-red-500 font-extrabold uppercase text-xs sm:text-sm tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/30 mb-2">
                  FLEW AWAY
                </span>
                <span className="text-4xl sm:text-6xl font-black text-red-500 tracking-tight">
                  @{crashedAtMultiplier ? crashedAtMultiplier.toFixed(2) : multiplier.toFixed(2)}x
                </span>
                <span className="text-xs text-gray-400 mt-2">Next round will begin in a moment...</span>
              </div>
            )}
          </div>

          {/* Betting Dashboard Control Panel */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Wager Input & Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold text-gray-300">Wager Amount (Credits)</span>
                  <span>Balance: <strong className="text-[#E5B842]">{balance.toLocaleString()}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={balance}
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    disabled={status === 'running' && currentBet?.status === 'placed'}
                    className="bg-[#141A27] border-[#222C42] text-white font-bold text-base h-11"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWagerAmount((prev) => Math.floor(prev / 2) || 10)}
                    disabled={status === 'running' && currentBet?.status === 'placed'}
                    className="border-[#222C42] text-gray-300 h-11 px-3 text-xs"
                  >
                    1/2
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWagerAmount((prev) => Math.min(balance, prev * 2))}
                    disabled={status === 'running' && currentBet?.status === 'placed'}
                    className="border-[#222C42] text-gray-300 h-11 px-3 text-xs"
                  >
                    2X
                  </Button>
                </div>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[10, 50, 100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWagerAmount(amt)}
                      disabled={status === 'running' && currentBet?.status === 'placed'}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
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

              {/* Action Buttons: Place Bet / Cash Out */}
              <div className="flex flex-col justify-center h-full">
                {currentBet && currentBet.status === 'placed' && status === 'running' ? (
                  <Button
                    onClick={handleCashOut}
                    disabled={isCashingOut}
                    className="h-16 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-[#0B0E14] font-black text-lg sm:text-xl shadow-lg shadow-emerald-500/30 flex flex-col items-center justify-center animate-pulse"
                  >
                    <span>CASH OUT NOW</span>
                    <span className="text-xs font-bold text-[#0B0E14]/90">
                      +{Math.floor(currentBet.wager_amount * multiplier).toLocaleString()} Credits ({multiplier.toFixed(2)}x)
                    </span>
                  </Button>
                ) : currentBet && currentBet.status === 'cashed_out' ? (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-1">
                    <span className="text-xs text-emerald-400 font-bold block uppercase">Cashed Out Successfully!</span>
                    <span className="text-xl font-black text-white">
                      +{(currentBet.payout_amount || 0).toLocaleString()} Credits
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={handlePlaceBet}
                    disabled={status !== 'waiting' || isPlacingBet || wagerAmount > balance}
                    className="h-16 rounded-xl gold-button text-base sm:text-lg font-black shadow-lg shadow-[#E5B842]/20 flex flex-col items-center justify-center"
                  >
                    <span>{status === 'waiting' ? 'PLACE BET FOR NEXT FLIGHT' : 'WAIT FOR NEXT ROUND'}</span>
                    <span className="text-xs font-semibold text-[#0B0E14]/80">
                      {wagerAmount} Virtual Credits
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Multiplayer Bets Feed on Side */}
        <div className="p-4 rounded-2xl bg-[#0F1420] border border-[#1F293D] flex flex-col h-[400px] lg:h-auto shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A2234]">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase">
              <Users className="w-4 h-4 text-[#E5B842]" /> Arena Players
            </span>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
              {otherPlayers.length + (currentBet ? 1 : 0)} Live
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
            {/* User's own bet entry */}
            {currentBet && (
              <div className="p-2.5 rounded-xl bg-[#E5B842]/10 border border-[#E5B842]/40 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#E5B842] block">You (Your Bet)</span>
                  <span className="text-gray-400">{currentBet.wager_amount} Credits</span>
                </div>
                {currentBet.status === 'cashed_out' ? (
                  <span className="font-black text-emerald-400">
                    {((currentBet.cashout_multiplier_bps || 20000) / 10000).toFixed(2)}x
                  </span>
                ) : (
                  <span className="text-gray-400 font-semibold animate-pulse">In Flight</span>
                )}
              </div>
            )}

            {/* Other simulated players */}
            {otherPlayers.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-xl bg-[#141A27] border border-[#1F293D] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-gray-300 block">{p.name}</span>
                  <span className="text-gray-500 text-[11px]">{p.amount} Credits</span>
                </div>
                {p.cashedOutAt ? (
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                    {p.cashedOutAt.toFixed(2)}x
                  </span>
                ) : (
                  <span className="text-gray-500 text-[10px]">flying...</span>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#1A2234] text-center">
            <span className="text-[10px] text-gray-500 block">
              100% Provably Fair &bull; Virtual Credits Only
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
