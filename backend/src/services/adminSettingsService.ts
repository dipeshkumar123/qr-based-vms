import { pool } from "../db/pool.js";

const ALERT_THRESHOLDS_KEY = "alert_thresholds";

export type AlertThresholds = {
  registrationBacklogRatio: number;
  lowTodayCheckInRate: number;
  activePopulationGap: number;
};

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  registrationBacklogRatio: 0.35,
  lowTodayCheckInRate: 0.6,
  activePopulationGap: 8,
};

async function ensureAdminSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function parseThresholds(raw: any): AlertThresholds {
  const registrationBacklogRatio = Number(raw?.registrationBacklogRatio);
  const lowTodayCheckInRate = Number(raw?.lowTodayCheckInRate);
  const activePopulationGap = Number(raw?.activePopulationGap);

  if (!Number.isFinite(registrationBacklogRatio)) return DEFAULT_ALERT_THRESHOLDS;
  if (!Number.isFinite(lowTodayCheckInRate)) return DEFAULT_ALERT_THRESHOLDS;
  if (!Number.isFinite(activePopulationGap)) return DEFAULT_ALERT_THRESHOLDS;

  return {
    registrationBacklogRatio,
    lowTodayCheckInRate,
    activePopulationGap,
  };
}

export async function getAlertThresholds(): Promise<AlertThresholds> {
  await ensureAdminSettingsTable();
  const result = await pool.query(
    `SELECT value FROM admin_settings WHERE key = $1`,
    [ALERT_THRESHOLDS_KEY]
  );

  if (!result.rows[0]?.value) {
    return DEFAULT_ALERT_THRESHOLDS;
  }

  return parseThresholds(result.rows[0].value);
}

export async function saveAlertThresholds(next: AlertThresholds): Promise<AlertThresholds> {
  await ensureAdminSettingsTable();
  await pool.query(
    `INSERT INTO admin_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [ALERT_THRESHOLDS_KEY, JSON.stringify(next)]
  );
  return next;
}
