import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#F3F4F6] flex flex-col selection:bg-[#E5B842]/30 selection:text-[#FFF1C5]">
      <Header />
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {children}
      </div>
      <footer className="border-t border-[#182030] bg-[#0A0D14] py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#E5B842] inline-block animate-pulse"></span>
            Andhera Raja Virtual Arena &bull; Provably Fair Gaming
          </p>
          <p className="text-[11px] text-gray-500 max-w-md">
            Notice: All credits are virtual, non-redeemable, non-transferable, and cannot be exchanged for real money or rewards.
          </p>
        </div>
      </footer>
    </div>
  )
}
