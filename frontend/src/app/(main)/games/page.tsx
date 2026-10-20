'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { CreditAccount } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Coins,
  TrendingUp,
  Bomb,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  PlusCircle,
  Award,
} from 'lucide-react'

export default function GamesPage() {
  const [credits, setCredits] = useState<CreditAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const data = await apiClient.get<CreditAccount>('/api/v1/credits/balance')
        setCredits(data)
      } catch (error) {
        console.error('Failed to load credits:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCredits()
  }, [])

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#151B28] via-[#0F1420] to-[#0A0D15] border border-[#222C42] p-5 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#E5B842]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5B842]/10 border border-[#E5B842]/30 text-xs font-semibold text-[#E5B842]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PROVABLY FAIR VIRTUAL GAMING</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Choose Your Game, <span className="gold-gradient-text">Command The Odds</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              Play real-time multiplayer Aviator or uncover strategic gems in Mines. Powered by cryptographic HMAC-SHA256 commitments for 100% verified fair outcomes.
            </p>
          </div>

          {/* Quick Credit Status & Request */}
          <div className="w-full md:w-auto flex md:flex-col items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-[#090C12]/80 border border-[#1F293D]">
            <div className="text-left md:text-right">
              <span className="text-[11px] text-gray-400 block uppercase font-medium">Virtual Balance</span>
              <span className="text-xl sm:text-2xl font-black text-[#E5B842] flex items-center gap-1.5">
                <Coins className="w-5 h-5 text-[#E5B842]" />
                {loading ? '...' : (credits?.balance !== undefined ? credits.balance.toLocaleString() : '1,000')}
              </span>
            </div>
            <Link href="/credits" className="w-auto md:w-full">
              <Button size="sm" className="gold-button text-xs h-9 px-3 w-full">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Request Credits
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Games Section */}
      <div className="grid md:grid-cols-2 gap-5 sm:gap-7">
        {/* Aviator Game Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-[#0F1420] border border-[#1F293D] hover:border-[#E5B842]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#E5B842]/10 flex flex-col">
          {/* Top Decorative Graphic Area */}
          <div className="relative h-44 sm:h-52 bg-gradient-to-br from-[#182030] via-[#101522] to-[#0A0D15] overflow-hidden flex items-center justify-center p-6 border-b border-[#1A2234]">
            {/* Background Grid & Flight Path */}
            <div className="absolute inset-0 bg-[radial-gradient(#25324E_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <path
                d="M 10 160 Q 150 140, 250 80 T 400 30"
                fill="none"
                stroke="url(#goldGradient)"
                strokeWidth="3"
                strokeDasharray="4 4"
                className="opacity-70"
              />
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#182030" />
                  <stop offset="50%" stopColor="#E5B842" />
                  <stop offset="100%" stopColor="#FFF1C5" />
                </linearGradient>
              </defs>
            </svg>

            {/* Glowing Plane Icon & Multiplier Float */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#E5B842] to-[#FFF1C5] text-[#0B0E14] flex items-center justify-center shadow-lg shadow-[#E5B842]/30 group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                <TrendingUp className="w-9 h-9" />
              </div>
              <div className="px-3.5 py-1 rounded-full bg-[#080A0F]/90 border border-[#E5B842]/40 text-[#E5B842] font-black text-sm tracking-wider shadow-inner">
                MULTIPLIER &bull; UP TO 10,000X
              </div>
            </div>

            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              <Badge className="bg-[#E5B842]/15 text-[#E5B842] border-[#E5B842]/30 text-[10px] font-bold">
                MULTIPLAYER
              </Badge>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                LIVE
              </Badge>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-[#E5B842] transition-colors">
                  Aviator
                </h2>
                <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#E5B842]" /> Real-time Flight
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-snug">
                Place your virtual wager and watch the jet climb. Cash out before the committed crash point to multiply your credits!
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5B842]" />
                  <span>Shared Rounds</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Instant Cashout</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Verified Fairness</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>10–100,000 Wagers</span>
                </div>
              </div>
            </div>

            <Link href="/games/aviator" className="block pt-2">
              <Button className="w-full gold-button h-11 text-sm rounded-xl font-bold flex items-center justify-center gap-2">
                <span>Play Aviator</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mines Game Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-[#0F1420] border border-[#1F293D] hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col">
          {/* Top Decorative Graphic Area */}
          <div className="relative h-44 sm:h-52 bg-gradient-to-br from-[#122320] via-[#0F1A1B] to-[#0A0D15] overflow-hidden flex items-center justify-center p-6 border-b border-[#1A2234]">
            {/* Background Mini Grid */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="grid grid-cols-5 gap-1.5 w-60">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-7 rounded-md border ${
                      i % 3 === 0
                        ? 'bg-emerald-500/20 border-emerald-500/40'
                        : i % 4 === 0
                        ? 'bg-red-500/20 border-red-500/40'
                        : 'bg-[#182030] border-[#25324E]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Glowing Bomb/Diamond Emblem */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 text-[#0B0E14] flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                <Bomb className="w-9 h-9" />
              </div>
              <div className="px-3.5 py-1 rounded-full bg-[#080A0F]/90 border border-emerald-500/40 text-emerald-400 font-black text-sm tracking-wider shadow-inner">
                CUSTOM MINES &bull; STRATEGIC CASH OUT
              </div>
            </div>

            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                SOLO SESSION
              </Badge>
              <Badge className="bg-[#E5B842]/15 text-[#E5B842] border-[#E5B842]/30 text-[10px] font-bold">
                PROVABLY FAIR
              </Badge>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Mines
                </h2>
                <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Private Grid
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-snug">
                Configure your grid with 1 to 24 hidden mines. Reveal glowing gems to build your multiplier, and cash out whenever you choose!
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>5x5 Grid (25 Cells)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5B842]" />
                  <span>1 to 24 Mines</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>Growing Multiplier</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#141A27] px-2.5 py-2 rounded-lg border border-[#1F293D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Reveals On Loss</span>
                </div>
              </div>
            </div>

            <Link href="/games/mines" className="block pt-2">
              <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-[#0B0E14] h-11 text-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                <span>Play Mines</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Credit Stats Card */}
      <div className="rounded-2xl bg-[#0F1420] border border-[#1F293D] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1A2234]">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#E5B842]" />
            <h3 className="text-base sm:text-lg font-bold text-white">Your Lifetime Arena Stats</h3>
          </div>
          <Link href="/credits" className="text-xs font-semibold text-[#E5B842] hover:underline flex items-center gap-1">
            <span>View Full Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-center">
          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D]">
            <p className="text-xs font-medium text-gray-400">Available Virtual Balance</p>
            <p className="text-2xl font-black text-[#E5B842] mt-1">
              {loading ? '...' : (credits?.balance !== undefined ? credits.balance.toLocaleString() : '1,000')}
            </p>
            <span className="text-[10px] text-gray-500">Ready to wager</span>
          </div>

          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D]">
            <p className="text-xs font-medium text-gray-400">Lifetime Winnings Earned</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {loading ? '...' : (credits?.lifetime_earned !== undefined ? credits.lifetime_earned.toLocaleString() : '0')}
            </p>
            <span className="text-[10px] text-gray-500">Total game payouts</span>
          </div>

          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D]">
            <p className="text-xs font-medium text-gray-400">Lifetime Wagers Placed</p>
            <p className="text-2xl font-black text-gray-300 mt-1">
              {loading ? '...' : (credits?.lifetime_spent !== undefined ? credits.lifetime_spent.toLocaleString() : '0')}
            </p>
            <span className="text-[10px] text-gray-500">Total game turnover</span>
          </div>
        </div>
      </div>
    </div>
  )
}
