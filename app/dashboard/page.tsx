'use client'

import { Suspense } from 'react'
import { LoadingScreen } from '@/app/components/LoadingScreen'
import DashboardContent from '@/app/components/DashboardContent'

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardContent />
    </Suspense>
  )
}