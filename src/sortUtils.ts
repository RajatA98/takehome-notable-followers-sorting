/**
 * Generic, reusable sorting helpers for our data tables.
 *
 * A column's data type is auto-detected from the values in the column, and the
 * matching comparator is used to sort the rows. This is the same "auto-typed
 * sorting" idea our real table component uses.
 */

export type SortDirection = 'asc' | 'desc';

export type ColumnDataType = 'number' | 'string';

/**
 * Returns true when a value represents a finite number, whether it's already a
 * `number` or a numeric string like '1000000' (the shape our API sends counts
 * in). Blank/whitespace-only strings and non-numeric text return false.
 */
function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value === 'string') {
    return value.trim() !== '' && Number.isFinite(Number(value));
  }

  return false;
}

/**
 * Infers the type of a column from its values. A column is treated as numeric
 * only when *every* non-empty value in it is numeric (including numeric
 * strings); otherwise it's a string column. We scan all values rather than the
 * first so a column that's mostly text isn't mis-typed by one leading number
 * (and vice-versa).
 */
export function inferColumnType<T>(rows: T[], key: keyof T): ColumnDataType {
  const values = rows
    .map((row) => row[key])
    .filter((value) => value !== undefined && value !== null && value !== '');

  if (values.length > 0 && values.every(isNumeric)) {
    return 'number';
  }

  return 'string';
}

const comparators: Record<ColumnDataType, (a: unknown, b: unknown) => number> = {
  number: (a, b) => Number(a) - Number(b),
  string: (a, b) => String(a).localeCompare(String(b)),
};

/**
 * Returns a new array of rows sorted by `key` in the given `direction`.
 *
 * Direction is applied by negating the comparator for 'desc' rather than
 * reversing the result. Because ties compare to 0, JS's stable sort keeps
 * equal rows in their original order in both directions (reversing would have
 * flipped tied rows on every toggle).
 */
export function sortRows<T>(rows: T[], key: keyof T, direction: SortDirection): T[] {
  const type = inferColumnType(rows, key);
  const compare = comparators[type];
  const sign = direction === 'desc' ? -1 : 1;

  return [...rows].sort((rowA, rowB) => sign * compare(rowA[key], rowB[key]));
}
