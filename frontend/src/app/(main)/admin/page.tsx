'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { CreditRequest } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ShieldAlert,
  ArrowLeft,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  X,
  Users,
  Search,
  AlertCircle,
  Send,
} from 'lucide-react'

interface AdminStats {
  total_users: number
  pending_credit_requests: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  // Review Modal State
  const [reviewingRequest, setReviewingRequest] = useState<CreditRequest | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved')
  const [approvedAmount, setApprovedAmount] = useState<number>(1000)
  const [adminNote, setAdminNote] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)

  // Direct Allocation State
  const [allocUserId, setAllocUserId] = useState('')
  const [allocAmount, setAllocAmount] = useState<number>(5000)
  const [allocReason, setAllocReason] = useState('')
  const [submittingAlloc, setSubmittingAlloc] = useState(false)
  const [allocStatus, setAllocStatus] = useState<string | null>(null)

  const loadAdminData = useCallback(async () => {
    try {
      const [dash, reqs] = await Promise.all([
        apiClient.get<AdminStats>('/api/v1/admin/dashboard'),
        apiClient.get<CreditRequest[]>('/api/v1/admin/credit-requests?page_size=100'),
      ])

      setStats(dash)
      setRequests(Array.isArray(reqs) ? reqs : [])
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) {
        setIsUnauthorized(true)
      } else {
        console.error('Failed to load admin data:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  // Quick Approve full amount
  const handleQuickApprove = async (req: CreditRequest) => {
    if (!confirm(`Approve ${req.requested_amount.toLocaleString()} virtual credits for this user?`)) return

    try {
      await apiClient.patch(`/api/v1/admin/credit-requests/${req.id}`, {
        decision: 'approved',
        approved_amount: req.requested_amount,
        admin_note: 'Approved by Administrator',
      })
      await loadAdminData()
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed'
      alert(msg)
    }
  }

  // Submit Detailed Review (Approve or Reject)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewingRequest) return

    setSubmittingReview(true)
    setReviewMessage(null)

    try {
      const payload = {
        decision: reviewDecision,
        approved_amount: reviewDecision === 'approved' ? approvedAmount : undefined,
        admin_note: adminNote.trim() || undefined,
      }

      await apiClient.patch(`/api/v1/admin/credit-requests/${reviewingRequest.id}`, payload)

      setReviewingRequest(null)
      setAdminNote('')
      await loadAdminData()
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed'
      setReviewMessage(msg)
    } finally {
      setSubmittingReview(false)
    }
  }

  // Direct Credit Allocation to User
  const handleDirectAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allocUserId.trim() || allocAmount <= 0) return

    setSubmittingAlloc(true)
    setAllocStatus(null)

    try {
      await apiClient.post('/api/v1/admin/credits/allocate', {
        user_id: allocUserId.trim(),
        amount: allocAmount,
        reason: allocReason.trim() || 'Direct virtual credit grant from admin console',
      })

      setAllocStatus(`Successfully allocated ${allocAmount.toLocaleString()} virtual credits!`)
      setAllocUserId('')
      setAllocReason('')
      await loadAdminData()
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Allocation failed'
      setAllocStatus(`Error: ${msg}`)
    } finally {
      setSubmittingAlloc(false)
    }
  }

  if (isUnauthorized) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto" />
        <h1 className="text-2xl font-black text-white">Administrator Access Required</h1>
        <p className="text-sm text-gray-400">
          Your current account does not have administrator privileges to review credit requests or access the admin panel.
        </p>
        <Link href="/games">
          <Button className="gold-button font-bold text-xs h-10 px-4 mt-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Games
          </Button>
        </Link>
      </div>
    )
  }

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'all') return true
    return r.status === filterStatus
  })

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto animate-in fade-in">
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
              <ShieldAlert className="w-6 h-6 text-[#E5B842]" />
              Admin Credit Console
            </h1>
            <p className="text-xs text-gray-400">
              Review virtual credit requests and authoritative server ledger allocations.
            </p>
          </div>
        </div>

        <Badge className="bg-[#E5B842]/20 text-[#E5B842] border-[#E5B842]/40 text-xs px-3 py-1 font-bold">
          ADMINISTRATOR PRIVILEGES ACTIVE
        </Badge>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Pending Review Queue
          </span>
          <div className="text-3xl font-black text-amber-400 mt-2 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" />
            <span>{loading ? '...' : (stats?.pending_credit_requests ?? 0)}</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Awaiting approval or rejection</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Total Platform Users
          </span>
          <div className="text-3xl font-black text-white mt-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#E5B842]" />
            <span>{loading ? '...' : (stats?.total_users ?? 1)}</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Registered arena accounts</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#1F293D] shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Total Requests Logged
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-2 flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-400" />
            <span>{requests.length}</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Lifetime request history</span>
        </div>
      </div>

      {/* Credit Requests Queue Section */}
      <div className="rounded-2xl bg-[#0F1420] border border-[#1F293D] overflow-hidden shadow-xl space-y-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1A2234]">
          <div>
            <h2 className="text-lg font-bold text-white">Credit Request Review Queue</h2>
            <p className="text-xs text-gray-400">Review, approve, or reject user virtual credit allocations.</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#141A27] p-1 rounded-xl border border-[#1F293D]">
            {['pending', 'approved', 'rejected', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold capitalize transition-colors ${
                  filterStatus === st
                    ? 'bg-[#E5B842] text-[#0B0E14]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs">
            No requests matching filter &quot;{filterStatus}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A27] text-gray-400 border-b border-[#1F293D] uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Request ID / Date</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Requested</th>
                  <th className="py-3 px-4">User Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2234]">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#121723] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-gray-300 block text-[11px]">#{req.id.slice(0, 8)}</span>
                      <span className="text-gray-500 text-[10px]">{new Date(req.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-400 text-[11px] truncate max-w-[140px]">
                      {req.user_id}
                    </td>
                    <td className="py-3 px-4 font-black text-white text-sm">
                      {req.requested_amount.toLocaleString()} Credits
                    </td>
                    <td className="py-3 px-4 text-gray-300 max-w-xs truncate">
                      {req.message || <span className="text-gray-600 italic">No message provided</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        className={`text-[10px] capitalize font-bold ${
                          req.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : req.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}
                      >
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleQuickApprove(req)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2.5 text-[11px]"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReviewingRequest(req)
                              setApprovedAmount(req.requested_amount)
                              setReviewDecision('approved')
                              setAdminNote('')
                              setReviewMessage(null)
                            }}
                            className="border-[#222C42] text-gray-300 hover:text-white h-7 px-2 text-[11px]"
                          >
                            Review
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[11px] italic">
                          {req.admin_note || 'Reviewed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Direct Credit Allocation Tool */}
      <div className="rounded-2xl bg-[#0F1420] border border-[#1F293D] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#E5B842]" />
            Direct Virtual Credit Grant
          </h2>
          <p className="text-xs text-gray-400">
            Authoritatively allocate virtual credits directly to any registered user ID without a request.
          </p>
        </div>

        {allocStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold ${
              allocStatus.startsWith('Error')
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {allocStatus}
          </div>
        )}

        <form onSubmit={handleDirectAllocation} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-300">Target User UUID</Label>
            <Input
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={allocUserId}
              onChange={(e) => setAllocUserId(e.target.value)}
              className="bg-[#141A27] border-[#222C42] text-xs font-mono text-white h-10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-300">Virtual Amount</Label>
            <Input
              type="number"
              min={10}
              max={10000000}
              value={allocAmount}
              onChange={(e) => setAllocAmount(parseInt(e.target.value) || 0)}
              className="bg-[#141A27] border-[#222C42] text-xs font-bold text-white h-10"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={submittingAlloc}
            className="gold-button font-bold text-xs h-10 px-4 rounded-xl flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submittingAlloc ? 'Allocating...' : 'Allocate Credits'}</span>
          </Button>
        </form>
      </div>

      {/* Review Modal Dialog */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F1420] border border-[#2A354C] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setReviewingRequest(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Review Credit Request</h3>
              <p className="text-xs text-gray-400">
                Request #{reviewingRequest.id.slice(0, 8)} &bull; Requested: {reviewingRequest.requested_amount.toLocaleString()} Credits
              </p>
            </div>

            {reviewMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {reviewMessage}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300">Decision</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('approved')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      reviewDecision === 'approved'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-[#141A27] border-[#222C42] text-gray-400'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('rejected')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      reviewDecision === 'rejected'
                        ? 'bg-red-600 border-red-500 text-white shadow-md'
                        : 'bg-[#141A27] border-[#222C42] text-gray-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject Request
                  </button>
                </div>
              </div>

              {reviewDecision === 'approved' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-300">Approved Virtual Amount</Label>
                  <Input
                    type="number"
                    min={1}
                    max={reviewingRequest.requested_amount * 2}
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(parseInt(e.target.value) || 0)}
                    className="bg-[#141A27] border-[#222C42] text-white font-bold h-10"
                    required
                  />
                  <span className="text-[10px] text-gray-500">
                    You can approve full or partial amounts.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300">Admin Note / Feedback</Label>
                <Textarea
                  placeholder="e.g. Approved for testing Aviator multiplayer rounds..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="bg-[#141A27] border-[#222C42] text-xs text-white resize-none h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReviewingRequest(null)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReview}
                  className={`font-bold text-xs h-10 px-4 rounded-xl ${
                    reviewDecision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {submittingReview ? 'Processing...' : reviewDecision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
