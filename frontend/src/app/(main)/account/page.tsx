'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiClient } from '@/lib/api'
import { CreditAccount, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  User as UserIcon,
  Coins,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Mail,
  Key,
  Calendar,
  Sparkles,
} from 'lucide-react'

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [credits, setCredits] = useState<CreditAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        const [userData, creditData] = await Promise.all([
          apiClient.get<User>('/api/v1/users/me').catch(() => null),
          apiClient.get<CreditAccount>('/api/v1/credits/balance').catch(() => null),
        ])

        if (userData) {
          setProfile(userData)
        } else if (session?.user) {
          // Fallback from session
          setProfile({
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Player',
            role: (session.user.email?.includes('pushpraj') ? 'admin' : 'user') as 'user' | 'admin',
            status: 'active',
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          })
        }

        setCredits(creditData)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0F1420] p-4 sm:p-5 rounded-2xl border border-[#1F293D]">
        <div className="flex items-center gap-3">
          <Link href="/games">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Lobby
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E5B842] to-[#B8871B] flex items-center justify-center text-[#0B0E14]">
              <UserIcon className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">
              Account Profile
            </h1>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-9 px-3"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out
        </Button>
      </div>

      {/* Main Profile Info Card */}
      <div className="p-5 sm:p-7 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1A2234]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1A2335] to-[#25324E] border border-[#E5B842]/40 flex items-center justify-center text-[#E5B842] text-2xl font-black shadow-inner">
              {profile?.username ? profile.username[0].toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {profile?.username || 'Player'}
                </h2>
                <Badge
                  className={`capitalize text-xs font-bold ${
                    profile?.role === 'admin'
                      ? 'bg-[#E5B842]/20 text-[#E5B842] border-[#E5B842]/40'
                      : 'bg-[#182030] text-gray-300 border-[#2A354C]'
                  }`}
                >
                  {profile?.role || 'User'}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                {profile?.email || 'Loading...'}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-gray-400 block font-medium">Virtual Balance</span>
            <span className="text-2xl font-black text-[#E5B842] flex sm:justify-end items-center gap-1.5">
              <Coins className="w-5 h-5 text-[#E5B842]" />
              {loading ? '...' : (credits?.balance ?? 1000).toLocaleString()} Credits
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D] space-y-1">
            <span className="text-gray-400 font-semibold flex items-center gap-1.5 uppercase text-[10px]">
              <Key className="w-3.5 h-3.5 text-[#E5B842]" /> Account UUID
            </span>
            <p className="font-mono text-gray-200 text-[11px] truncate">{profile?.id || '—'}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D] space-y-1">
            <span className="text-gray-400 font-semibold flex items-center gap-1.5 uppercase text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Account Status
            </span>
            <p className="text-emerald-400 font-bold capitalize">{profile?.status || 'Active'}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D] space-y-1">
            <span className="text-gray-400 font-semibold flex items-center gap-1.5 uppercase text-[10px]">
              <Coins className="w-3.5 h-3.5 text-[#E5B842]" /> Lifetime Winnings
            </span>
            <p className="text-white font-bold">{credits?.lifetime_earned?.toLocaleString() ?? 0} Credits</p>
          </div>

          <div className="p-4 rounded-xl bg-[#141A27] border border-[#1F293D] space-y-1">
            <span className="text-gray-400 font-semibold flex items-center gap-1.5 uppercase text-[10px]">
              <Calendar className="w-3.5 h-3.5 text-blue-400" /> Member Since
            </span>
            <p className="text-gray-300">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Active Member'}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/credits">
            <Button size="sm" className="gold-button font-bold text-xs h-9 px-4">
              <Coins className="w-3.5 h-3.5 mr-1.5" />
              Manage &amp; Request Credits
            </Button>
          </Link>
          <Link href="/games">
            <Button variant="outline" size="sm" className="border-[#222C42] text-gray-300 hover:text-white text-xs h-9 px-4">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#E5B842]" />
              Back to Game Lobby
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
