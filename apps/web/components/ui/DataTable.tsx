import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sky-blue">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-beige text-xs uppercase tracking-wide text-teal">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-semibold" key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-blue">
          {rows.map((row) => (
            <tr className="bg-white" key={rowKey(row)}>
              {columns.map((column) => (
                <td className="px-4 py-3" key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
