'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card'

export default function TestDashboard() {
  const [user, setUser] = useState<any>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    testAuth()
  }, [])

  const testAuth = async () => {
    try {
      setStatus('Checking authentication...')
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        setError(`Auth error: ${authError.message}`)
        setStatus('Not authenticated')
        return
      }

      if (!user) {
        setStatus('No user logged in')
        return
      }

      setUser(user)
      setStatus('User authenticated')
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const testLogin = async () => {
    try {
      setStatus('Logging in...')
      setError('')

      // Test login with a dummy user
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456'
      })

      if (error) {
        setError(`Login error: ${error.message}`)
        setStatus('Login failed')
        return
      }

      setUser(data.user)
      setStatus('Login successful')
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const testSignup = async () => {
    try {
      setStatus('Creating test account...')
      setError('')

      const testEmail = `test${Date.now()}@example.com`
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456'
      })

      if (error) {
        setError(`Signup error: ${error.message}`)
        setStatus('Signup failed')
        return
      }

      setUser(data.user)
      setStatus(`Account created: ${testEmail}`)
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const testLogout = async () => {
    try {
      setStatus('Logging out...')
      await supabase.auth.signOut()
      setUser(null)
      setStatus('Logged out')
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark p-8">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard Test Page</h1>

        <Card variant="glass" className="mb-6">
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p className="text-white font-mono">{status || 'Ready'}</p>
              </div>

              {error && (
                <div className="p-4 bg-error/10 border border-error/30 rounded">
                  <p className="text-error">{error}</p>
                </div>
              )}

              {user && (
                <div>
                  <p className="text-sm text-gray-400">User ID</p>
                  <p className="text-white font-mono text-xs">{user.id}</p>
                  <p className="text-sm text-gray-400 mt-2">Email</p>
                  <p className="text-white font-mono">{user.email}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Test Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Button onClick={testAuth} variant="gradient">
                Check Auth
              </Button>

              <Button onClick={testSignup} variant="gradient">
                Create Test Account
              </Button>

              <Button onClick={testLogin} variant="gradient">
                Test Login
              </Button>

              <Button onClick={testLogout} variant="outline">
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <a href="/dashboard" className="text-matrix hover:text-matrix-light">
            Go to Real Dashboard →
          </a>
        </div>
      </div>
    </div>
  )
}