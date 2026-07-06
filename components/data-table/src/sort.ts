import type { ColumnDef, SortDirection } from './types.js';

type Comparator = (a: unknown, b: unknown) => number;

export function createComparator(column: ColumnDef, direction: SortDirection): Comparator {
  if (direction === 'none') return () => 0;

  const base = column.compare ?? resolveByType(column.type);
  const flip = direction === 'desc' ? -1 : 1;

  return (a: unknown, b: unknown): number => {
    const aNull = a == null;
    const bNull = b == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;  // nulls last
    if (bNull) return -1;
    return flip * base(a, b);
  };
}

function resolveByType(type: string | undefined): Comparator {
  switch (type) {
    case 'number':
      return (a, b) => (a as number) - (b as number);
    case 'date':
      return (a, b) => new Date(a as string).getTime() - new Date(b as string).getTime();
    case 'text':
    default:
      return (a, b) => String(a).localeCompare(String(b));
  }
}
