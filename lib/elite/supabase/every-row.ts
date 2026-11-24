// Every row a query matches, not just the first thousand.
//
// The database hands back at most 1,000 rows for one request, silently:
// no error, the rest is simply not there. Any read that spans players on a
// table that grows every week (elite_homework above all) passes that mark
// sooner or later, and then whatever is built on it is wrong without
// saying so.
//
// That happened in November 2026: elite_homework reached 1,432 rows, the
// hourly audit read 1,000 of them, and it reported "no plan for live week
// 10" for players whose week was built and live. The coach dashboard's
// "plans to build", the 6pm digest and the daily training reminder read
// the same table the same way.
//
// So a read across players goes through everyRow: the query is asked for a
// page at a time, in a fixed order, until a page comes back short.
//
//   const rows = await everyRow<Row>((from, to) =>
//     admin.from("elite_homework").select("player_id, week").order("id").range(from, to)
//   );
//
// The query MUST carry an order that never ties (the primary key), or two
// pages can overlap and skip rows. tests/every-row.test.ts holds both: the
// paging itself, and that no read across players on a growing table is
// made any other way.
export const ROW_PAGE = 1000;

type Page = PromiseLike<{ data: unknown; error?: unknown }>;

export async function everyRow<T>(page: (from: number, to: number) => Page, size: number = ROW_PAGE): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    // A failed page ends the read with what came before it, the same
    // "treat as nothing" the single unpaged reads did.
    if (error) return out;
    const batch = (data as T[] | null) ?? [];
    out.push(...batch);
    if (batch.length < size) return out;
  }
}
