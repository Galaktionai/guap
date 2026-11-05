// Money is kept in kopecks (integers) everywhere; only the UI formats it.

const NBSP = ' ';
const MINUS = '−';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 8425000 → "84 250 ₽", 12345 → "123,45 ₽". `sign` adds "+" to positives. */
export function formatMoney(kopecks: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(kopecks);
  const rubles = groupThousands(String(Math.floor(abs / 100)));
  const rest = abs % 100;
  const fraction = rest ? ',' + String(rest).padStart(2, '0') : '';
  const sign = kopecks < 0 ? MINUS : opts.sign && kopecks > 0 ? '+' : '';
  return `${sign}${rubles}${fraction}${NBSP}₽`;
}

/** Signed amount of a transaction: "+95 000 ₽" or "−2 340 ₽". */
export function formatTxAmount(type: 'income' | 'expense', amount: number): string {
  return formatMoney(type === 'income' ? amount : -amount, { sign: true });
}

/**
 * Cleans what the user typed into an amount field: digits and one decimal
 * separator with at most two digits after it. Returns the raw value
 * ("2340,5"), which `parseAmount` turns into kopecks.
 */
export function sanitizeAmountInput(text: string): string {
  let out = '';
  let sep = false;
  let decimals = 0;
  for (const ch of text.replace(/\./g, ',')) {
    if (ch >= '0' && ch <= '9') {
      if (sep) {
        if (decimals === 2) continue;
        decimals++;
      } else if (out === '0') {
        out = '';
      }
      out += ch;
    } else if (ch === ',' && !sep) {
      sep = true;
      out = (out || '0') + ',';
    }
  }
  return out.slice(0, 16);
}

/** "2340,5" → 234050; empty or zero → null. */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const [int, frac = ''] = raw.split(',');
  const kopecks = Number(int || '0') * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return Number.isFinite(kopecks) && kopecks > 0 ? kopecks : null;
}

/** "2340,5" → "2 340,5" for display while typing. */
export function formatAmountInput(raw: string): string {
  if (!raw) return '';
  const [int, frac] = raw.split(',');
  return groupThousands(int) + (frac !== undefined ? ',' + frac : '');
}

/** plural(3, ['операция', 'операции', 'операций']) → "операции". */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function countLabel(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_PREPOSITIONAL = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

/** "Ноябрь 2026" */
export function monthTitle(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "в ноябре" */
export function inMonth(d: Date): string {
  return `в ${MONTHS_PREPOSITIONAL[d.getMonth()]}`;
}

/** Local month bounds as ISO strings for the API: [from, to). */
export function monthRange(d: Date): { from: string; to: string } {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Сегодня", "Вчера", "2 ноября", "28 декабря 2025". */
export function dayLabel(d: Date, now = new Date()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  const base = `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "14:20" */
export function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Сегодня, 14:20" */
export function dateTimeLabel(d: Date): string {
  return `${dayLabel(d)}, ${timeLabel(d)}`;
}

/** Groups items (already sorted newest first) by local day. */
export function groupByDay<T>(items: T[], getDate: (item: T) => Date): { key: string; date: Date; items: T[] }[] {
  const groups: { key: string; date: Date; items: T[] }[] = [];
  for (const item of items) {
    const date = getDate(item);
    const key = String(startOfDay(date));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, date, items: [item] });
  }
  return groups;
}
