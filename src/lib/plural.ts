/**
 * Số ít/số nhiều cho câu tiếng Anh do code sinh ra: `en(1, "entry", "entries")`
 * → "1 entry", `en(3, "day")` → "3 days". Bản tiếng Việt không chia số nhiều
 * nên không cần.
 */
export const en = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;
