'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/app/components/ui/Button'

interface PaymentStatusModalProps {
  status: 'success' | 'error' | 'cancel' | null
  onClose: () => void
}

export default function PaymentStatusModal({ status, onClose }: PaymentStatusModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (status) {
      setIsVisible(true)
    }
  }, [status])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  if (!status) return null

  const getModalContent = () => {
    switch (status) {
      case 'success':
        return {
          icon: '🎉',
          title: '決済完了！',
          message: 'SMARTGRAMの有料プランにご契約いただき、ありがとうございます！',
          details: [
            '✅ 決済が正常に完了しました',
            '🚀 今すぐSMARTGRAMの全機能をご利用いただけます',
            '📱 デバイス登録がまだの方は、登録を行ってください',
            '💬 ご不明な点がございましたら、サポートまでお気軽にお問い合わせください'
          ],
          buttonText: 'ダッシュボードを確認',
          bgColor: 'from-green-800/40 via-emerald-800/30 to-teal-800/40',
          borderColor: 'border-green-400/30'
        }

      case 'error':
        return {
          icon: '❌',
          title: '決済エラー',
          message: '決済処理中にエラーが発生しました。',
          details: [
            '🔄 しばらく時間をおいてから再度お試しください',
            '💳 カード情報に問題がないかご確認ください',
            '📞 問題が続く場合は、サポートまでお問い合わせください',
            '💡 別の決済方法もお試しいただけます'
          ],
          buttonText: '再試行する',
          bgColor: 'from-red-800/40 via-pink-800/30 to-rose-800/40',
          borderColor: 'border-red-400/30'
        }

      case 'cancel':
        return {
          icon: '⚠️',
          title: '決済キャンセル',
          message: '決済がキャンセルされました。',
          details: [
            '🔄 いつでも再度お試しいただけます',
            '💭 プランについてご質問がございましたら、サポートまでお気軽にどうぞ',
            '📋 現在のプラン情報は下記でご確認いただけます',
            '💡 体験版から始めることも可能です'
          ],
          buttonText: 'ダッシュボードに戻る',
          bgColor: 'from-yellow-800/40 via-amber-800/30 to-orange-800/40',
          borderColor: 'border-yellow-400/30'
        }

      default:
        return null
    }
  }

  const content = getModalContent()
  if (!content) return null

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className={`bg-gradient-to-br ${content.bgColor} backdrop-blur-xl border ${content.borderColor} rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl transform transition-all duration-300 ${
        isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
      }`}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">
            {content.icon}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            {content.title}
          </h2>
          <p className="text-white/80 text-sm md:text-base">
            {content.message}
          </p>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <ul className="space-y-2">
            {content.details.map((detail, index) => (
              <li key={index} className="text-white/80 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">{detail.split(' ')[0]}</span>
                <span>{detail.substring(detail.indexOf(' ') + 1)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center space-y-3">
          <Button
            onClick={handleClose}
            className={`w-full ${
              status === 'success'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                : status === 'error'
                ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600'
            } text-white shadow-xl`}
            size="lg"
          >
            {content.buttonText}
          </Button>

          {status !== 'success' && (
            <button
              onClick={handleClose}
              className="text-white/60 hover:text-white/80 text-sm underline transition-colors"
            >
              ダッシュボードに戻る
            </button>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-white/50">
            {status === 'success' && '🎁 ご契約ありがとうございます'}
            {status === 'error' && '🔧 サポート: support@smartgram.jp'}
            {status === 'cancel' && '💭 ご質問: support@smartgram.jp'}
          </p>
        </div>
      </div>
    </div>
  )
}