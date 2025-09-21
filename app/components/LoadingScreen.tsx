'use client'

import React from 'react'

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingScreen({ message = '読み込み中...', fullScreen = true }: LoadingScreenProps) {
  const containerClass = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-white'
    : 'flex items-center justify-center p-8'

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="relative">
          {/* Animated loading spinner */}
          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
        <p className="mt-4 text-gray-600 animate-pulse">{message}</p>
      </div>
    </div>
  )
}

export function InlineLoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center space-x-2 p-4">
      <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="text-gray-600">{message}</span>
    </div>
  )
}