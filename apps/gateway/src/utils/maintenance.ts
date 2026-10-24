import type { AutonomiaRuntimeEnv } from "../types.ts";
// 定時維護本體:Node 進入點(nodeServer 的 in-process timer)與
// Cloudflare Workers(cron trigger → Durable Object 維護端點)共用。
// 過期/隔離保留單對帳 + rate limit bucket 清理;對帳可重跑、不重複扣退。

import {
  cleanupAutonomiaRateLimitBuckets,
  reconcileStaleAutonomiaReservations,
  resolveQuarantinedAutonomiaReservations,
} from "./aiBilling.ts";
import { cleanupAutonomiaIdempotentReplays } from "./aiIdempotency.ts";
import { reconcileAutonomiaProviderInFlight } from "./aiProviderPool.ts";

export async function runAutonomiaMaintenance(env: AutonomiaRuntimeEnv): Promise<{
  staleReservations: number;
  quarantinedReservations: number;
  expiredReplays: number;
  inFlightReconciled: number;
}> {
  const limit = Number(env?.AUTONOMIA_RECONCILE_LIMIT) || 50;
  await cleanupAutonomiaRateLimitBuckets(env);
  const stale = await reconcileStaleAutonomiaReservations(env, { limit });
  const quarantined = await resolveQuarantinedAutonomiaReservations(env, { limit });
  // 過期重放列的刪除失敗不應阻斷對帳:清理是漸進的,下個週期會再試。
  const expiredReplays = await cleanupAutonomiaIdempotentReplays(env).catch(() => 0);
  // FUNC-02:in_flight 觀測對帳(逾期未歸還的租約會讓它高估到下一次 claim
  // 才自癒);失敗同樣不阻斷其他維護工作,下個週期再試。
  const inFlightReconciled = await reconcileAutonomiaProviderInFlight(env)
    .then((reconciled: Array<{ credentialId: string }>) => reconciled.length)
    .catch(() => 0);
  return {
    staleReservations: stale.length,
    quarantinedReservations: quarantined.length,
    expiredReplays,
    inFlightReconciled,
  };
}
