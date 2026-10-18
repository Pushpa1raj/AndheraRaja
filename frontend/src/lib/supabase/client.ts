import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const validUrl = (supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')))
    ? supabaseUrl
    : 'https://placeholder.supabase.co'
  const validKey = supabaseKey || 'placeholder-anon-key'

  return createBrowserClient(
    validUrl,
    validKey
  )
}
