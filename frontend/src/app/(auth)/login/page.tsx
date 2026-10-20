'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Shield, Coins, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/games')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080A0F] p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#E5B842]/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-[#0D111A] border border-[#1F293D] shadow-2xl relative z-10">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F3C958] via-[#E5B842] to-[#B8871B] flex items-center justify-center shadow-lg shadow-[#E5B842]/20">
            <Sparkles className="w-6 h-6 text-[#080A0F]" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-wider uppercase gold-gradient-text">
              Andhera Raja
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs mt-1">
              Virtual Gaming Arena • Pure Entertainment
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-[#151B28] border-[#1F293D] text-white placeholder-gray-500 focus:border-[#E5B842] focus:ring-[#E5B842]/20 h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-gray-300">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-[#151B28] border-[#1F293D] text-white placeholder-gray-500 focus:border-[#E5B842] focus:ring-[#E5B842]/20 h-10 rounded-xl"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full gold-button font-bold text-sm h-11 rounded-xl uppercase tracking-wider"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Arena'}
            </Button>
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-[#E5B842] hover:underline font-semibold">
                  Create Account
                </Link>
              </p>
            </div>
            <div className="pt-3 border-t border-[#1F293D]/60 flex items-center justify-center gap-2 text-[11px] text-gray-500">
              <Coins className="w-3.5 h-3.5 text-[#E5B842]/70" />
              <span>100% Virtual non-redeemable credits. Zero real money.</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

