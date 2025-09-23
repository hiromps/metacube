-- ================================
-- SMARTGRAM マルチプラン対応データベースマイグレーション
-- Version: 1.0.0
-- Date: 2025-01-25
-- ================================

-- 1. plansテーブル作成
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL, -- 円単位（例: 1980 = ¥1,980）
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, yearly
    features JSONB NOT NULL DEFAULT '{}',
    limitations JSONB NOT NULL DEFAULT '{}',
    paypal_plan_id VARCHAR(255), -- PayPalのプランID
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. サンプルプランデータ投入
INSERT INTO plans (name, display_name, price, billing_cycle, features, limitations, paypal_plan_id, sort_order) VALUES
('trial', '3日間トライアル', 0, 'trial',
 '{"timeline_lua": true, "follow_lua": false, "unfollow_lua": false, "hashtaglike_lua": false, "activelike_lua": false, "priority_support": false}',
 '{"daily_actions": 10, "total_actions": 30, "duration_days": 3}',
 NULL, 1),

('starter', 'STARTERプラン', 2980, 'monthly',
 '{"timeline_lua": true, "follow_lua": false, "unfollow_lua": false, "hashtaglike_lua": false, "activelike_lua": false, "priority_support": false}',
 '{"daily_actions": 50, "total_actions": null, "duration_days": null}',
 'P-STARTER-MONTHLY-2980', 2),

('pro', 'PROプラン', 6980, 'monthly',
 '{"timeline_lua": true, "follow_lua": true, "unfollow_lua": true, "hashtaglike_lua": false, "activelike_lua": false, "priority_support": true}',
 '{"daily_actions": 200, "total_actions": null, "duration_days": null}',
 'P-PRO-MONTHLY-6980', 3),

('pro_yearly', 'PROプラン（年額）', 69800, 'yearly',
 '{"timeline_lua": true, "follow_lua": true, "unfollow_lua": true, "hashtaglike_lua": false, "activelike_lua": false, "priority_support": true}',
 '{"daily_actions": 200, "total_actions": null, "duration_days": null}',
 'P-PRO-YEARLY-69800', 4),

('max', 'MAXプラン', 15800, 'monthly',
 '{"timeline_lua": true, "follow_lua": true, "unfollow_lua": true, "hashtaglike_lua": true, "activelike_lua": true, "priority_support": true, "early_access": true, "dedicated_support": true}',
 '{"daily_actions": null, "total_actions": null, "duration_days": null}',
 'P-MAX-MONTHLY-15800', 5);

-- 3. devicesテーブル拡張
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS usage_limits JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_usage JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_usage_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- 4. subscriptionsテーブル拡張
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS previous_plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS upgrade_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS downgrade_date TIMESTAMP WITH TIME ZONE;

-- 5. 既存データのマイグレーション
-- 既存のtrialステータスのデバイスをtrialプランに割り当て
UPDATE devices
SET plan_id = (SELECT id FROM plans WHERE name = 'trial')
WHERE status = 'trial' AND plan_id IS NULL;

-- 既存のactiveステータスのデバイスをproプランに割り当て
UPDATE devices
SET plan_id = (SELECT id FROM plans WHERE name = 'pro'),
    plan_started_at = created_at
WHERE status = 'active' AND plan_id IS NULL;

-- 既存のregisteredステータスのデバイスをtrialプランに割り当て
UPDATE devices
SET plan_id = (SELECT id FROM plans WHERE name = 'trial')
WHERE status = 'registered' AND plan_id IS NULL;

-- 6. インデックス作成
CREATE INDEX IF NOT EXISTS idx_devices_plan_id ON devices(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_devices_usage_reset ON devices(last_usage_reset);

-- 7. 使用量リセット用の関数作成
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
    -- 前日の0時を過ぎているデバイスの使用量をリセット
    UPDATE devices
    SET current_usage = jsonb_set(
        COALESCE(current_usage, '{}'),
        '{daily_actions}',
        '0'
    ),
    last_usage_reset = DATE_TRUNC('day', NOW())
    WHERE last_usage_reset < DATE_TRUNC('day', NOW());
END;
$$ LANGUAGE plpgsql;

-- 8. 使用量確認用の関数作成
CREATE OR REPLACE FUNCTION check_usage_limit(
    p_device_id UUID,
    p_action_type VARCHAR DEFAULT 'daily_actions'
)
RETURNS TABLE (
    can_execute BOOLEAN,
    current_count INTEGER,
    limit_count INTEGER,
    plan_name VARCHAR
) AS $$
DECLARE
    v_device_record RECORD;
    v_plan_record RECORD;
    v_current_usage INTEGER := 0;
    v_limit INTEGER := NULL;
BEGIN
    -- デバイス情報取得
    SELECT d.*, p.name as plan_name, p.limitations
    INTO v_device_record
    FROM devices d
    JOIN plans p ON d.plan_id = p.id
    WHERE d.id = p_device_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 'unknown'::VARCHAR;
        RETURN;
    END IF;

    -- 現在の使用量取得
    v_current_usage := COALESCE(
        (v_device_record.current_usage->p_action_type)::INTEGER,
        0
    );

    -- 制限値取得
    v_limit := (v_device_record.limitations->p_action_type)::INTEGER;

    -- 制限がない場合は無制限
    IF v_limit IS NULL THEN
        RETURN QUERY SELECT true, v_current_usage, -1, v_device_record.plan_name;
        RETURN;
    END IF;

    -- 制限チェック
    RETURN QUERY SELECT
        (v_current_usage < v_limit),
        v_current_usage,
        v_limit,
        v_device_record.plan_name;
END;
$$ LANGUAGE plpgsql;

-- 9. 使用量インクリメント用の関数作成
CREATE OR REPLACE FUNCTION increment_usage(
    p_device_id UUID,
    p_action_type VARCHAR DEFAULT 'daily_actions',
    p_increment INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    new_count INTEGER,
    limit_count INTEGER,
    exceeded BOOLEAN
) AS $$
DECLARE
    v_current INTEGER := 0;
    v_limit INTEGER := NULL;
    v_new_count INTEGER;
BEGIN
    -- 使用量チェック
    SELECT current_count, limit_count
    INTO v_current, v_limit
    FROM check_usage_limit(p_device_id, p_action_type);

    -- 制限に達している場合
    IF v_limit IS NOT NULL AND v_current >= v_limit THEN
        RETURN QUERY SELECT false, v_current, v_limit, true;
        RETURN;
    END IF;

    -- 使用量をインクリメント
    v_new_count := v_current + p_increment;

    UPDATE devices
    SET current_usage = jsonb_set(
        COALESCE(current_usage, '{}'),
        ARRAY[p_action_type],
        to_jsonb(v_new_count)
    )
    WHERE id = p_device_id;

    -- 結果を返す
    RETURN QUERY SELECT
        true,
        v_new_count,
        COALESCE(v_limit, -1),
        (v_limit IS NOT NULL AND v_new_count >= v_limit);
END;
$$ LANGUAGE plpgsql;

-- 10. プラン変更用の関数作成
CREATE OR REPLACE FUNCTION change_device_plan(
    p_device_id UUID,
    p_new_plan_name VARCHAR,
    p_paypal_subscription_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message VARCHAR,
    new_plan_id UUID
) AS $$
DECLARE
    v_new_plan_id UUID;
    v_old_plan_id UUID;
    v_subscription_id UUID;
BEGIN
    -- 新しいプランIDを取得
    SELECT id INTO v_new_plan_id
    FROM plans
    WHERE name = p_new_plan_name AND is_active = true;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'プランが見つかりません', NULL::UUID;
        RETURN;
    END IF;

    -- 現在のプランIDを取得
    SELECT plan_id INTO v_old_plan_id
    FROM devices
    WHERE id = p_device_id;

    -- デバイスのプランを更新
    UPDATE devices
    SET plan_id = v_new_plan_id,
        plan_started_at = NOW(),
        current_usage = '{}', -- 使用量をリセット
        last_usage_reset = DATE_TRUNC('day', NOW())
    WHERE id = p_device_id;

    -- サブスクリプションが存在する場合は更新
    IF p_paypal_subscription_id IS NOT NULL THEN
        UPDATE subscriptions
        SET plan_id = v_new_plan_id,
            previous_plan_id = v_old_plan_id,
            upgrade_date = CASE
                WHEN v_new_plan_id > v_old_plan_id THEN NOW()
                ELSE upgrade_date
            END,
            downgrade_date = CASE
                WHEN v_new_plan_id < v_old_plan_id THEN NOW()
                ELSE downgrade_date
            END
        WHERE paypal_subscription_id = p_paypal_subscription_id;
    END IF;

    RETURN QUERY SELECT true, 'プランの変更が完了しました', v_new_plan_id;
END;
$$ LANGUAGE plpgsql;

-- 11. プラン情報取得用のビュー作成
CREATE OR REPLACE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.device_hash,
    d.user_id,
    d.status,
    d.trial_ends_at,
    d.plan_started_at,
    d.plan_expires_at,
    d.current_usage,
    d.last_usage_reset,
    p.id as plan_id,
    p.name as plan_name,
    p.display_name as plan_display_name,
    p.price as plan_price,
    p.features as plan_features,
    p.limitations as plan_limitations,
    s.id as subscription_id,
    s.paypal_subscription_id,
    s.status as subscription_status
FROM devices d
JOIN plans p ON d.plan_id = p.id
LEFT JOIN subscriptions s ON d.id = s.device_id;

-- 12. 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_modtime
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- マイグレーション完了
COMMENT ON TABLE plans IS 'SMARTGRAMマルチプラン対応 - プラン定義テーブル';
COMMENT ON FUNCTION reset_daily_usage() IS '日次使用量リセット用関数';
COMMENT ON FUNCTION check_usage_limit(UUID, VARCHAR) IS '使用量制限チェック用関数';
COMMENT ON FUNCTION increment_usage(UUID, VARCHAR, INTEGER) IS '使用量インクリメント用関数';
COMMENT ON FUNCTION change_device_plan(UUID, VARCHAR, VARCHAR) IS 'プラン変更用関数';
COMMENT ON VIEW device_plan_view IS 'デバイス・プラン統合ビュー';