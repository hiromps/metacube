// User and subscription status types

export enum UserStatus {
  VISITOR = 'visitor',           // 未登録
  REGISTERED = 'registered',     // 無料会員（教材の概要のみ）
  TRIAL = 'trial',              // 体験期間中（3日間）
  ACTIVE = 'active',            // 有料会員
  EXPIRED = 'expired',          // 期限切れ
  SUSPENDED = 'suspended'       // アカウント停止
}

export interface UserProfile {
  id: string;
  email: string;
  status: UserStatus;
  deviceId?: string;
  deviceHash?: string;
  trialActivated?: boolean;
  trialActivatedAt?: string;
  firstExecutionAt?: string;
  trialEndsAt?: string;
  subscriptionId?: string;
  paypalSubscriptionId?: string;
  subscriptionStatus?: string;
  statusDescription?: string;
  hasAccessToContent?: boolean;
  hasAccessToTools?: boolean;
  timeRemainingSeconds?: number;
}

export interface ContentAccess {
  hasAccess: boolean;
  canUseTools: boolean;
  status: UserStatus;
  statusDescription: string;
  trialEndsAt?: string;
  reason?: string;
}


export interface DeviceRegistration {
  success: boolean;
  deviceId?: string;
  status?: UserStatus;
  message?: string;
  error?: string;
}


// Helper function to determine what content to show
export function getAccessLevel(status: UserStatus): {
  showOverview: boolean;
  showDetailedGuide: boolean;
  showTools: boolean;
  showDashboard: boolean;
} {
  switch (status) {
    case UserStatus.VISITOR:
      return {
        showOverview: true,
        showDetailedGuide: false,
        showTools: false,
        showDashboard: false
      };

    case UserStatus.REGISTERED:
      return {
        showOverview: true,
        showDetailedGuide: false,
        showTools: false,
        showDashboard: true
      };

    case UserStatus.TRIAL:
    case UserStatus.ACTIVE:
      return {
        showOverview: true,
        showDetailedGuide: true,
        showTools: true,          // Full access
        showDashboard: true
      };

    case UserStatus.EXPIRED:
    case UserStatus.SUSPENDED:
    default:
      return {
        showOverview: true,
        showDetailedGuide: false,
        showTools: false,
        showDashboard: true
      };
  }
}

// Status display helpers
export function getStatusColor(status: UserStatus): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return 'text-green-600';
    case UserStatus.TRIAL:
      return 'text-blue-600';
    case UserStatus.EXPIRED:
    case UserStatus.SUSPENDED:
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function getStatusBadge(status: UserStatus): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return 'bg-green-100 text-green-800';
    case UserStatus.TRIAL:
      return 'bg-blue-100 text-blue-800';
    case UserStatus.EXPIRED:
    case UserStatus.SUSPENDED:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}