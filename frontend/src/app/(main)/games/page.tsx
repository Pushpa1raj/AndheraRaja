'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gamepad2, Coins, TrendingUp } from 'lucide-react'

interface CreditAccount {
  user_id: string
  balance: number
  lifetime_earned: number
  lifetime_spent: number
}

export default function GamesPage() {
  const router = useRouter()
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Andhera Raja</h1>
          <div className="flex items-center gap-4">
            <Link href="/credits">
              <Button variant="outline" size="sm">
                <Coins className="w-4 h-4 mr-2" />
                {loading ? '...' : credits?.balance.toLocaleString() || '0'} Credits
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="outline" size="sm">Account</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Aviator Game */}
          <Link href="/games/aviator">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Aviator</CardTitle>
                  <TrendingUp className="w-8 h-8 text-[#635BFF]" />
                </div>
                <CardDescription>
                  Watch the multiplier climb and cash out before it crashes!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Shared multiplayer rounds</p>
                  <p>• Real-time betting</p>
                  <p>• Provably fair outcomes</p>
                  <p>• Cash out anytime before crash</p>
                </div>
                <Button className="w-full mt-4 bg-[#635BFF] hover:bg-[#5248E6]">
                  Play Aviator
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Mines Game */}
          <Link href="/games/mines">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Mines</CardTitle>
                  <Gamepad2 className="w-8 h-8 text-[#14B8A6]" />
                </div>
                <CardDescription>
                  Reveal safe cells to increase your multiplier!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Private sessions</p>
                  <p>• Choose grid size and mine count</p>
                  <p>• Multiplier grows with each reveal</p>
                  <p>• Provably fair mine placement</p>
                </div>
                <Button className="w-full mt-4 bg-[#14B8A6] hover:bg-[#0F9A8E]">
                  Play Mines
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Credit Stats */}
        {credits && !loading && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">Current Balance</p>
                  <p className="text-2xl font-bold text-[#635BFF]">
                    {credits.balance.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lifetime Earned</p>
                  <p className="text-2xl font-bold text-[#14B8A6]">
                    {credits.lifetime_earned.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lifetime Spent</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {credits.lifetime_spent.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
