import { db, closeDb } from "../db/client";
import { loadLocalEnv } from "../lib/env";
loadLocalEnv();
import { aiContent, project } from "../db/schema";

async function main() {
  const d = await db();
  const rows = await d.select().from(aiContent);
  const byLocale = new Map<string, number>();
  for (const r of rows as any[]) byLocale.set(r.locale, (byLocale.get(r.locale) ?? 0) + 1);
  console.log("aiContent by locale:", JSON.stringify(Object.fromEntries(byLocale)));

  const en = (rows as any[]).filter((r) => r.locale === "en");
  console.log("en rows:", en.length);
  if (en[0]) {
    console.log("en sample hook:", String(en[0].hook).slice(0, 80));
    console.log("en sample oneLiner:", String(en[0].oneLiner).slice(0, 80));
  }

  // 项目自身的 description 是英文还是中文？
  const ps = await d.select({ name: project.name, desc: project.description }).from(project).limit(6);
  console.log("--- project.description 抽样 ---");
  for (const p of ps as any[]) console.log("  ", p.name, "|", String(p.desc).slice(0, 70));
  await closeDb();
  process.exit(0);
}
main();
