import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface UserProfile {
  id: string
  role: 'investor' | 'farmer' | 'admin'
  full_name: string | null
  phone: string | null
  phone_verified: boolean
  status: 'pending' | 'approved' | 'rejected' | 'active'
  created_at: string
}

interface AuthState {
  user: any | null
  profile: UserProfile | null
  isLoading: boolean
  mfaLoading: boolean
  mfaEnrolled: boolean
  mfaFactorId: string | null
  isAal2: boolean
  error: string | null
  load: () => Promise<void>
  refreshMfaState: () => Promise<void>
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: (role?: 'investor' | 'farmer') => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, role: 'investor' | 'farmer', phone: string, full_name?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const OAUTH_ROLE_KEY = 'maweshihub_oauth_role'

async function ensureProfile(user: any): Promise<UserProfile> {
  const metadata = user.user_metadata || {}
  const storedRole = typeof window !== 'undefined' ? window.localStorage.getItem(OAUTH_ROLE_KEY) : null
  const role = (metadata.role === 'farmer' || metadata.role === 'investor')
    ? metadata.role
    : (storedRole === 'farmer' || storedRole === 'investor')
      ? storedRole
      : null

  if (!role) {
    throw new Error('Please create your account from Signup and choose Farmer or Investor first.')
  }

  const fullName = metadata.full_name || metadata.name || null
  const phone = metadata.phone || null
  const basePayload: Record<string, any> = {
    id: user.id,
    role,
    phone,
    phone_verified: false,
    status: 'pending',
    full_name: fullName,
  }

  const payloads = [
    basePayload,
    withoutKeys(basePayload, ['phone_verified']),
    withoutKeys(basePayload, ['full_name']),
    withoutKeys(basePayload, ['phone_verified', 'full_name']),
  ]

  let lastError: any = null
  for (const payload of payloads) {
    const result = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (!result.error && result.data) {
      if (typeof window !== 'undefined') window.localStorage.removeItem(OAUTH_ROLE_KEY)
      return result.data as UserProfile
    }

    lastError = result.error
    const message = result.error?.message || ''
    if (!message.includes('column') && !message.includes('schema cache')) break
  }

  throw lastError || new Error('Unable to create profile')
}

function withoutKeys<T extends Record<string, any>>(payload: T, keys: string[]) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !keys.includes(key)))
}

async function reconcileOAuthRole(profile: UserProfile, user: any): Promise<UserProfile> {
  if (typeof window === 'undefined') return profile
  const storedRole = window.localStorage.getItem(OAUTH_ROLE_KEY)
  if (storedRole) {
    window.localStorage.removeItem(OAUTH_ROLE_KEY)
  }
  if (user?.user_metadata?.role && user.user_metadata.role !== profile.role && profile.role !== 'admin') {
    await supabase.auth.updateUser({ data: { role: profile.role } }).catch(() => null)
  }
  return profile
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      mfaLoading: true,
      mfaEnrolled: false,
      mfaFactorId: null,
      isAal2: false,
      error: null,

      load: async () => {
        try {
          set({ isLoading: true, error: null })
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            set({ user: session.user })
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle()
            if (error) throw error
            const safeProfile = profile
              ? await reconcileOAuthRole(profile as UserProfile, session.user)
              : await ensureProfile(session.user)
            set({ profile: safeProfile })
            await get().refreshMfaState()
          } else {
            set({
              user: null,
              profile: null,
              mfaLoading: false,
              mfaEnrolled: false,
              mfaFactorId: null,
              isAal2: false
            })
          }
        } catch (err: any) {
          set({ error: err.message })
        } finally {
          set({ isLoading: false })
        }
      },

      refreshMfaState: async () => {
        try {
          set({ mfaLoading: true })
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            set({
              mfaLoading: false,
              mfaEnrolled: false,
              mfaFactorId: null,
              isAal2: false
            })
            return
          }

          const [{ data: aalData }, { data: factorData }] = await Promise.all([
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            supabase.auth.mfa.listFactors()
          ])

          const verifiedTotp = factorData?.totp.find((factor) => factor.status === 'verified')
          set({
            mfaLoading: false,
            mfaEnrolled: Boolean(verifiedTotp),
            mfaFactorId: verifiedTotp?.id ?? null,
            isAal2: aalData?.currentLevel === 'aal2'
          })
        } catch {
          set({
            mfaLoading: false,
            mfaEnrolled: false,
            mfaFactorId: null,
            isAal2: false
          })
        }
      },

      login: async (email, password) => {
        try {
          set({ error: null })
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          await get().load()
          return { success: true }
        } catch (err: any) {
          set({ error: err.message })
          return { success: false, error: err.message }
        }
      },

      loginWithGoogle: async (role) => {
        try {
          set({ error: null })
          if (role && typeof window !== 'undefined') {
            window.localStorage.setItem(OAUTH_ROLE_KEY, role)
          }
          const redirectTo = `${window.location.origin}/login`
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          })
          if (error) throw error
          return { success: true }
        } catch (err: any) {
          set({ error: err.message })
          return { success: false, error: err.message }
        }
      },

      signup: async (email, password, role, phone, full_name) => {
        try {
          set({ error: null })
          const { data, error: authError } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
              data: { role, phone, full_name: full_name || null }
            }
          })
          if (authError) throw authError
          if (!data.user) throw new Error('User creation failed')
          await new Promise(resolve => setTimeout(resolve, 500))
          await get().load()
          return { success: true }
        } catch (err: any) {
          set({ error: err.message })
          return { success: false, error: err.message }
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({
          user: null,
          profile: null,
          error: null,
          mfaLoading: false,
          mfaEnrolled: false,
          mfaFactorId: null,
          isAal2: false
        })
      }
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user, profile: s.profile }) }
  )
)
