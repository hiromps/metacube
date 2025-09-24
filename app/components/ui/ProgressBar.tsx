import { useEffect, useState } from 'react'

interface ProgressBarProps {
  isActive: boolean
  duration?: number // milliseconds
  steps?: string[]
  currentStep?: number
  className?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isActive,
  duration = 30000, // 30 seconds default
  steps = [],
  currentStep = 0,
  className = ''
}) => {
  const [progress, setProgress] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setProgress(0)
      setCurrentStepIndex(0)
      return
    }

    const interval = 100 // Update every 100ms
    const totalSteps = Math.floor(duration / interval)
    const stepIncrement = 100 / totalSteps

    let currentProgress = 0
    let stepIndex = 0

    const progressInterval = setInterval(() => {
      currentProgress += stepIncrement

      if (currentProgress >= 100) {
        currentProgress = 100
        clearInterval(progressInterval)
      }

      // Update step based on progress
      if (steps.length > 0) {
        const newStepIndex = Math.min(
          Math.floor((currentProgress / 100) * steps.length),
          steps.length - 1
        )
        if (newStepIndex !== stepIndex) {
          stepIndex = newStepIndex
          setCurrentStepIndex(stepIndex)
        }
      }

      setProgress(currentProgress)
    }, interval)

    return () => clearInterval(progressInterval)
  }, [isActive, duration, steps.length])

  // Use external currentStep if provided
  const displayStepIndex = currentStep >= 0 ? currentStep : currentStepIndex

  if (!isActive) return null

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Bar */}
      <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
        </div>
      </div>

      {/* Progress Percentage */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          進捗: {Math.round(progress)}%
        </span>

        {/* Current Step */}
        {steps.length > 0 && (
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            {steps[displayStepIndex] || steps[0]}
          </span>
        )}
      </div>

      {/* Step Indicators */}
      {steps.length > 0 && (
        <div className="flex justify-between mt-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center text-xs ${
                index <= displayStepIndex
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {/* Step Circle */}
              <div
                className={`w-3 h-3 rounded-full mr-2 ${
                  index < displayStepIndex
                    ? 'bg-blue-500'
                    : index === displayStepIndex
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {index < displayStepIndex && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Step Label - Only show on larger screens */}
              <span className="hidden sm:inline">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProgressBar