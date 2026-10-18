'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, apiClient } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { CreditAccount, CreditRequest, CreditTransaction } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function CreditsPage() {
  const router = useRouter()
  const [account, setAccount] = useState<CreditAccount | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [accountData, transactionsData, requestsData] = await Promise.all([
        apiClient.get<CreditAccount>('/api/v1/credits/balance'),
        apiClient.get<{ items: CreditTransaction[] }>('/api/v1/credits/transactions?page=1&page_size=10'),
        apiClient.get<CreditRequest[]>('/api/v1/credits/requests'),
      ])
      setAccount(accountData)
      setTransactions(transactionsData.items)
      setRequests(requestsData)
    } catch (error) {
      console.error('Failed to load credit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const idempotencyKey = `${session?.user.id}-${Date.now()}`

      await api('/api/v1/credits/requests', {
        method: 'POST',
        body: {
          requested_amount: parseInt(requestAmount),
          message: requestMessage,
        },
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      })

      setShowRequestForm(false)
      setRequestAmount('')
      setRequestMessage('')
      await loadData()
    } catch (error) {
      console.error('Failed to submit request:', error)
      alert('Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: CreditRequest['status']) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pending' },
      approved: { variant: 'default' as const, icon: CheckCircle, text: 'Approved' },
      rejected: { variant: 'destructive' as const, icon: XCircle, text: 'Rejected' },
      cancelled: { variant: 'outline' as const, icon: XCircle, text: 'Cancelled' },
      partially_approved: { variant: 'secondary' as const, icon: CheckCircle, text: 'Partially Approved' },
    }
    const { variant, icon: Icon, text } = variants[status]
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {text}
      </Badge>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F6F8FC] flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/games">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Games
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Balance Card */}
        {account && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Current Balance</CardTitle>
                <Button onClick={() => setShowRequestForm(!showRequestForm)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Request Credits
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#635BFF] mb-4">
                {account.balance.toLocaleString()} Credits
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Lifetime Earned</p>
                  <p className="text-xl font-semibold text-[#14B8A6]">
                    {account.lifetime_earned.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Lifetime Spent</p>
                  <p className="text-xl font-semibold text-gray-600">
                    {account.lifetime_spent.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request Form */}
        {showRequestForm && (
          <Card>
            <CardHeader>
              <CardTitle>Request Credits</CardTitle>
              <CardDescription>
                Submit a request to administrators for credit allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Explain why you need credits..."
                    disabled={submitting}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRequestForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Requests */}
        {requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.requested_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="capitalize">
                      {tx.type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className={tx.amount > 0 ? 'text-[#14B8A6]' : 'text-red-600'}>
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{tx.balance_after.toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(tx.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
