import { fileURLToPath } from "node:url";
import { AUTONOMIA_SCHEMA_VERSION } from "@autonomia/core/schemaMigration";
import dotenv from "dotenv";
import { ensureAutonomiaSchemaReady, seedAutonomiaAdminFromEnv } from "../src/utils/bootstrap.ts";
import { closePostgresClients, installNodeAutonomiaDbAdapter } from "../src/utils/db.ts";

// 遷移流程(與 Workers DO 首次啟動共用 ensureAutonomiaSchemaReady/
// seedAutonomiaAdminFromEnv,見 src/utils/bootstrap.ts):
//   1. point_transactions(AI 計費流水的平台層底表)
//   2. users(內建帳號系統)—— 先於版本化遷移:v4 對 users 做
//      ALTER ADD COLUMN session_epoch(SEC-01 會話撤銵)
//   3. Autonomia schema(版本化遷移)+ 可選管理員種子(ADMIN_EMAIL/
//      ADMIN_PASSWORD)
// 會話撤銷的管理指令:scripts/revokeAutonomiaSessions.ts。

dotenv.config({
  path: fileURLToPath(new URL("../.dev.vars", import.meta.url)),
  quiet: true,
});

try {
  await installNodeAutonomiaDbAdapter();

  const { migrated } = await ensureAutonomiaSchemaReady(process.env);

  const seeded = await seedAutonomiaAdminFromEnv(process.env);
  if (seeded) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    console.log(
      seeded.created
        ? `Admin account ready for ${adminEmail} (password not printed).`
        : `Admin account already exists for ${adminEmail}; role ensured.`,
    );
  } else {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped admin bootstrap.");
  }

  console.log(
    `Autonomia schema is ready at version ${AUTONOMIA_SCHEMA_VERSION} ` +
      `(${migrated ? "migrated" : "already ready"}).`,
  );
} catch (error: any) {
  console.error("Autonomia schema migration failed:", error?.message || error);
  process.exitCode = 1;
} finally {
  await closePostgresClients();
}
