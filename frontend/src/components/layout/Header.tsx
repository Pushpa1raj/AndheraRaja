'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiClient } from '@/lib/api'
import { CreditAccount } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Coins,
  Gamepad2,
  TrendingUp,
  Bomb,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Sparkles,
  PlusCircle,
} from 'lucide-react'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [balance, setBalance] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchUserData = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserEmail(session.user.email || null)
        const email = session.user.email?.toLowerCase() || ''
        if (email.includes('pushpraj') || session.user.user_metadata?.role === 'admin') {
          setIsAdmin(true)
        }
      }

      const account = await apiClient.get<CreditAccount>('/api/v1/credits/balance')
      if (account && typeof account.balance === 'number') {
        setBalance(account.balance)
      }
    } catch {
      // Fallback: balance remains null or defaults to 1,000 for display
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()

    // Poll balance periodically to keep it synced
    const interval = setInterval(fetchUserData, 12000)

    // Listen for custom balance update events from games
    const handleBalanceUpdate = () => fetchUserData()
    window.addEventListener('credits-updated', handleBalanceUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('credits-updated', handleBalanceUpdate)
    }
  }, [])

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore signout error
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  const navLinks = [
    { href: '/games', label: 'All Games', icon: Gamepad2 },
    { href: '/games/aviator', label: 'Aviator', icon: TrendingUp },
    { href: '/games/mines', label: 'Mines', icon: Bomb },
    { href: '/credits', label: 'Credits', icon: Coins },
    { href: '/account', label: 'Account', icon: UserIcon },
  ]

  return (
    <header className="sticky top-0 z-50 bg-[#0D111A]/95 backdrop-blur-md border-b border-[#1F293D]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/games" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F3C958] via-[#E5B842] to-[#B8871B] flex items-center justify-center shadow-lg shadow-[#E5B842]/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-[#0B0E14]" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-wider gold-gradient-text uppercase leading-none">
                Andhera Raja
              </span>
              <span className="text-[9px] font-semibold tracking-widest text-gray-400 uppercase leading-tight">
                Virtual Arena
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#182030] text-[#E5B842] border border-[#E5B842]/30 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-[#151B28]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'bg-[#E5B842]/15 text-[#E5B842] border border-[#E5B842]/40'
                    : 'text-[#E5B842] hover:bg-[#E5B842]/10'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Admin Panel
              </Link>
            )}
          </nav>

          {/* Right Header Area (Balance + User + Mobile Menu Toggle) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Virtual Credit Balance Pill */}
            <Link
              href="/credits"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#182030] to-[#121723] border border-[#E5B842]/40 hover:border-[#E5B842] transition-all group"
            >
              <div className="w-6 h-6 rounded-full bg-[#E5B842]/20 flex items-center justify-center text-[#E5B842]">
                <Coins className="w-3.5 h-3.5 text-[#E5B842] animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-gray-400 font-medium leading-none hidden sm:inline">
                  Virtual Credits
                </span>
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#E5B842] transition-colors leading-tight">
                  {loading ? '...' : (balance !== null ? balance.toLocaleString() : '1,000')}
                </span>
              </div>
              <PlusCircle className="w-3.5 h-3.5 text-[#E5B842] opacity-70 group-hover:opacity-100 ml-0.5" />
            </Link>

            {/* Desktop Account / Sign Out */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </Button>
            </div>

            {/* Mobile Hamburger Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-300 hover:text-white hover:bg-[#182030] p-1.5 h-9 w-9"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#E5B842]" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Responsive Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0D111A] border-b border-[#1F293D] px-4 pt-2 pb-5 space-y-2 animate-in slide-in-from-top-3">
          {/* User info banner */}
          {userEmail && (
            <div className="px-3 py-2 rounded-lg bg-[#151B28] text-xs text-gray-400 flex items-center justify-between border border-[#1F293D]">
              <span className="truncate max-w-[200px]">{userEmail}</span>
              {isAdmin && (
                <Badge className="bg-[#E5B842]/20 text-[#E5B842] border-[#E5B842]/30 text-[10px]">
                  Admin
                </Badge>
              )}
            </div>
          )}

          {/* Links */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive
                      ? 'bg-[#182030] text-[#E5B842] border border-[#E5B842]/40'
                      : 'bg-[#121723] text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#E5B842]" />
                  {link.label}
                </Link>
              )
            })}
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-[#E5B842]/15 text-[#E5B842] border border-[#E5B842]/40 mt-1"
            >
              <ShieldAlert className="w-4 h-4" />
              Admin Management Console
            </Link>
          )}

          <div className="pt-2 border-t border-[#1F293D] flex justify-between items-center">
            <span className="text-xs text-gray-500">Non-monetary virtual credits</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
