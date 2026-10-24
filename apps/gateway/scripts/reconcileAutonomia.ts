import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  reconcileStaleAutonomiaReservations,
  resolveQuarantinedAutonomiaReservations,
} from "../src/utils/aiBilling.ts";
import { reconcileAutonomiaProviderInFlight } from "../src/utils/aiProviderPool.ts";
import { installNodeAutonomiaDbAdapter } from "../src/utils/db.ts";

dotenv.config({
  path: fileURLToPath(new URL("../.dev.vars", import.meta.url)),
  quiet: true,
});

await installNodeAutonomiaDbAdapter();

const parsedLimit = Number.parseInt(process.env.AUTONOMIA_RECONCILE_LIMIT || "100", 10);
const limit = Number.isSafeInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;

function summarize(outcomes: any[]) {
  return (outcomes || []).reduce((totals: any, outcome: any) => {
    const state = outcome?.reservationState || "unknown";
    totals[state] = (totals[state] || 0) + 1;
    return totals;
  }, {});
}

try {
  const stale = await reconcileStaleAutonomiaReservations(process.env, { limit });
  console.log(
    `Autonomia stale reconciliation: ${JSON.stringify({ scanned: stale.length, ...summarize(stale) })}`,
  );

  // 隔離超過 1 小時的保留單全額退還,確保 needs_reconciliation 有自動出口。
  const quarantined = await resolveQuarantinedAutonomiaReservations(process.env, { limit });
  console.log(
    `Autonomia quarantine resolution: ${JSON.stringify({ scanned: quarantined.length, ...summarize(quarantined) })}`,
  );

  // FUNC-02:in_flight 觀測對帳(與 in-process 維護迴圈同一條 UPDATE)——
  // 外部排程器情境下程序內 timer 不會跑,逾期未歸還租約造成的觀測 drift
  // 也需要在這裡歸零/歸真。失敗不阻斷其他對帳工作。
  const inFlightReconciled = await reconcileAutonomiaProviderInFlight(process.env)
    .then((reconciled: Array<{ credentialId: string }>) => reconciled.length)
    .catch(() => 0);
  console.log(
    `Autonomia provider in-flight reconciliation: ${JSON.stringify({ reconciled: inFlightReconciled })}`,
  );
} catch (error: any) {
  console.error("Autonomia reconciliation failed:", error?.code || error?.name || "unknown");
  process.exitCode = 1;
}
