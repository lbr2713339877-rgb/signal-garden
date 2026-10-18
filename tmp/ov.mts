import { loadLocalEnv } from "../src/lib/env.ts";
loadLocalEnv();
const { getDb } = await import("../src/db/client.ts");
const { raw } = await getDb();
const r = await raw.query(`SELECT signal_date::text AS d, count(*) FILTER (WHERE is_published) AS n FROM daily_signal GROUP BY 1 ORDER BY 1 DESC LIMIT 8`);
console.log("days:", r.rows);
const o = await raw.query(`
  WITH days AS (SELECT DISTINCT signal_date FROM daily_signal WHERE is_published ORDER BY signal_date DESC LIMIT 2),
  a AS (SELECT project_id FROM daily_signal WHERE signal_date=(SELECT max(signal_date) FROM days) AND is_published),
  b AS (SELECT project_id FROM daily_signal WHERE signal_date=(SELECT min(signal_date) FROM days) AND is_published)
  SELECT (SELECT count(*) FROM a) AS newest, (SELECT count(*) FROM b) AS prev,
    (SELECT count(*) FROM a JOIN b USING(project_id)) AS overlap`);
console.log("overlap:", o.rows);
process.exit(0);
