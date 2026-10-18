import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      redirect('/games')
    }
  } catch {
    // Fall back to login if unauthenticated or not yet configured
  }

  redirect('/login')
}
