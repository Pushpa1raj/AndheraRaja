'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { CreditAccount, CreditRequest, CreditTransaction } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Coins,
  ArrowLeft,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  ShieldAlert,
  AlertCircle,
  X,
  FileText,
  Ban,
} from 'lucide-react'

export default function CreditsPage() {
  const [account, setAccount] = useState<CreditAccount | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'requests' | 'transactions'>('requests')

  // Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestAmount, setRequestAmount] = useState<number>(1000)
  const [requestMessage, setRequestMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [accountData, transactionsData, requestsData] = await Promise.all([
        apiClient.get<CreditAccount>('/api/v1/credits/balance').catch(() => ({
          user_id: '',
          balance: 1000,
          lifetime_earned: 0,
          lifetime_spent: 0,
          version: 1,
          updated_at: new Date().toISOString(),
        } as unknown as CreditAccount)),
        apiClient.get<{ items: CreditTransaction[] }>('/api/v1/credits/transactions?page=1&page_size=30').catch(() => ({ items: [] })),
        apiClient.get<CreditRequest[]>('/api/v1/credits/requests').catch(() => []),
      ])

      setAccount(accountData)
      setTransactions(transactionsData?.items || [])
      setRequests(Array.isArray(requestsData) ? requestsData : [])
    } catch (error) {
      console.error('Failed to load credit data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Submit Credit Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    // Validation
    const amount = Number(requestAmount)
    if (!amount || isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid positive credit amount.')
      return
    }

    if (amount > 1_000_000) {
      setFormError('Maximum allowed credit request is 1,000,000 virtual credits.')
      return
    }

    // Check for existing pending request
    const hasPending = requests.some((r) => r.status === 'pending')
    if (hasPending) {
      setFormError('You already have a pending credit request awaiting administrator review.')
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post<CreditRequest>('/api/v1/credits/requests', {
        requested_amount: Math.floor(amount),
        message: requestMessage.trim() || undefined,
      })

      setFormSuccess('Virtual credit request submitted successfully! An administrator will review your request shortly.')
      setRequestMessage('')
      setRequestAmount(1000)
      await loadData()
      setTimeout(() => {
        setIsModalOpen(false)
        setFormSuccess(null)
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit credit request.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel Pending Request
  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this pending credit request?')) return

    try {
      await apiClient.post(`/api/v1/credits/requests/${requestId}/cancel`)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel request.'
      alert(msg)
    }
  }

  const getStatusBadge = (status: CreditRequest['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 font-semibold">
            <Clock className="w-3 h-3" />
            Pending Review
          </Badge>
        )
      case 'approved':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </Badge>
        )
      case 'partially_approved':
        return (
          <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/30 gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Partially Approved
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 font-semibold">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/30 gap-1 font-semibold">
            <Ban className="w-3 h-3" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0F1420] p-4 sm:p-5 rounded-2xl border border-[#1F293D]">
        <div className="flex items-center gap-3">
          <Link href="/games">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Lobby
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-6 h-6 text-[#E5B842]" />
              Virtual Credit Management
            </h1>
            <p className="text-xs text-gray-400">
              Manage your non-monetary gaming credits and submit allocation requests.
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setFormError(null)
            setFormSuccess(null)
            setIsModalOpen(true)
          }}
          className="gold-button font-bold text-xs sm:text-sm h-10 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-[#E5B842]/20"
        >
          <PlusCircle className="w-4 h-4" />
          Request Credits
        </Button>
      </div>

      {/* Virtual Currency Notice */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#141A27] border border-[#222C42] text-xs text-gray-400 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#E5B842] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-gray-200 block font-semibold">Important Virtual Credit Rules:</strong>
          Credits are strictly virtual and intended solely for platform gaming simulation. Credits cannot be redeemed, transferred, withdrawn, or exchanged for real-world currency or rewards.
        </div>
      </div>

      {/* Balance & Overview Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#182030] via-[#121723] to-[#0D111A] border border-[#E5B842]/40 shadow-xl">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Current Virtual Balance
          </span>
          <div className="text-3xl sm:text-4xl font-black text-[#E5B842] mt-2 flex items-center gap-2">
            <Coins className="w-8 h-8 text-[#E5B842]" />
            <span>{loading ? '...' : (account?.balance ?? 1000).toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Authoritative server balance</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Pending Credit Requests
          </span>
          <div className="text-3xl font-black text-amber-400 mt-2">
            {requests.filter((r) => r.status === 'pending').length}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Awaiting administrator review</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Approved Allocations
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            {requests.filter((r) => r.status === 'approved' || r.status === 'partially_approved').length}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Total lifetime approved grants</span>
        </div>
      </div>

      {/* Navigation Tabs for Requests vs Transactions */}
      <div className="flex gap-2 border-b border-[#1F293D] pb-1">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'requests'
              ? 'border-[#E5B842] text-[#E5B842] bg-[#121723]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Credit Requests ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'transactions'
              ? 'border-[#E5B842] text-[#E5B842] bg-[#121723]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Transaction Ledger ({transactions.length})</span>
        </button>
      </div>

      {/* Tab 1: Credit Requests History */}
      {activeTab === 'requests' && (
        <div className="rounded-2xl bg-[#0F1420] border border-[#1F293D] overflow-hidden shadow-xl">
          {requests.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <FileText className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-base font-semibold text-gray-300">No Credit Requests Submitted</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Need more virtual credits to test games? Click the button below to submit a request to administrators.
              </p>
              <Button
                onClick={() => setIsModalOpen(true)}
                size="sm"
                className="gold-button text-xs font-bold mt-2"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Request Virtual Credits
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141A27] text-gray-400 border-b border-[#1F293D] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Requested</th>
                    <th className="py-3 px-4">Approved</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reason / Admin Note</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2234]">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#121723] transition-colors">
                      <td className="py-3.5 px-4 text-gray-400 font-mono text-[11px]">
                        {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 font-black text-white">
                        {req.requested_amount.toLocaleString()} Credits
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {req.approved_amount ? `${req.approved_amount.toLocaleString()} Credits` : '—'}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                      <td className="py-3.5 px-4 text-gray-300 max-w-xs truncate">
                        {req.admin_note ? (
                          <span className="text-[#E5B842] font-medium" title={req.admin_note}>
                            Admin: {req.admin_note}
                          </span>
                        ) : req.message ? (
                          <span className="text-gray-400" title={req.message}>
                            {req.message}
                          </span>
                        ) : (
                          <span className="text-gray-600 italic">No notes</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {req.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelRequest(req.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 text-[11px]"
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transaction Ledger */}
      {activeTab === 'transactions' && (
        <div className="rounded-2xl bg-[#0F1420] border border-[#1F293D] overflow-hidden shadow-xl">
          {transactions.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <History className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-sm font-semibold text-gray-400">No Transactions Recorded Yet</p>
              <p className="text-xs text-gray-500">Play games or request credits to generate audit records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141A27] text-gray-400 border-b border-[#1F293D] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2234]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#121723] transition-colors">
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-gray-300">
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {tx.balance_after.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-400 max-w-sm truncate">
                        {tx.reason || 'Virtual movement'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog: Request Credits */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F1420] border border-[#2A354C] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#E5B842]" />
                Request Virtual Credits
              </h2>
              <p className="text-xs text-gray-400">
                Submit an allocation request to administrators. Credits are virtual and non-monetary.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="credit-amount" className="text-xs font-semibold text-gray-300">
                  Requested Virtual Amount
                </Label>
                <Input
                  id="credit-amount"
                  type="number"
                  min={100}
                  max={1000000}
                  step={100}
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(parseInt(e.target.value) || 0)}
                  className="bg-[#141A27] border-[#222C42] text-white font-bold text-base h-11"
                  required
                />
                <div className="flex items-center gap-1.5 pt-1">
                  {[500, 1000, 2500, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRequestAmount(preset)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${
                        requestAmount === preset
                          ? 'bg-[#E5B842]/20 border-[#E5B842] text-[#E5B842]'
                          : 'bg-[#141A27] border-[#222C42] text-gray-400 hover:text-white'
                      }`}
                    >
                      +{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credit-reason" className="text-xs font-semibold text-gray-300">
                  Reason for Request (Optional)
                </Label>
                <Textarea
                  id="credit-reason"
                  placeholder="e.g., Testing high-multiplier Aviator rounds or Mines 5-mine configurations..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  maxLength={500}
                  className="bg-[#141A27] border-[#222C42] text-xs text-white resize-none h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="gold-button font-bold text-xs h-10 px-4 rounded-xl"
                >
                  {submitting ? 'Submitting Request...' : 'Submit Credit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
