import type React from 'react';
import type { DataChanges, ModifiedTable, NewTable } from '@/app/_lib/types';
import { SectionHeader } from './SectionHeader';
import { WarningBanner } from './WarningBanner';

interface DataChangeViewProps {
  data: DataChanges;
}

export const DataChangeView: React.FC<DataChangeViewProps> = ({ data }) => (
  <div>
    <SectionHeader title="Data changes" description={data.description} />
    <div className="space-y-4">
      {data.newTables.map((table) => (
        <NewTableCard key={table.name} table={table} />
      ))}
      {data.modifiedTables.map((table) => (
        <ModifiedTableCard key={table.name} table={table} />
      ))}
      {data.droppedTables.map((name) => (
        <DroppedTableCard key={name} name={name} />
      ))}
    </div>
    {data.warning && <WarningBanner text={data.warning} />}
  </div>
);

interface NewTableCardProps {
  table: NewTable;
}

const NewTableCard: React.FC<NewTableCardProps> = ({ table }) => (
  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
    <div className="px-3.5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-[12px] font-medium text-emerald-900">New table</span>
      <span className="text-[12px] font-mono text-emerald-700">{table.name}</span>
    </div>
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-neutral-200 bg-neutral-50">
          <th className="text-left px-3.5 py-2 font-medium text-neutral-500 text-[11px] uppercase tracking-wide">
            Column
          </th>
          <th className="text-left px-3.5 py-2 font-medium text-neutral-500 text-[11px] uppercase tracking-wide">
            Type
          </th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {table.columns.map((col) => {
          const annotations: string[] = [];
          if (col.isPrimaryKey) annotations.push('primary key');
          if (col.foreignKey) annotations.push(`→ ${col.foreignKey}`);
          return (
            <tr key={col.name} className="border-b border-neutral-100 last:border-0">
              <td className="px-3.5 py-1.5 text-neutral-900">{col.name}</td>
              <td className="px-3.5 py-1.5 text-neutral-500">
                {col.type}
                {annotations.length > 0 && (
                  <span className="text-neutral-400"> {annotations.join(' ')}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

interface ModifiedTableCardProps {
  table: ModifiedTable;
}

const ModifiedTableCard: React.FC<ModifiedTableCardProps> = ({ table }) => (
  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
    <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      <span className="text-[12px] font-medium text-amber-900">Modified table</span>
      <span className="text-[12px] font-mono text-amber-700">{table.name}</span>
    </div>
    <table className="w-full text-[12px]">
      <tbody className="font-mono">
        {table.addedColumns.map((col) => (
          <tr key={`add-${col.name}`} className="border-b border-neutral-100 last:border-0">
            <td className="px-3.5 py-1.5 text-neutral-900">{col.name}</td>
            <td className="px-3.5 py-1.5 text-neutral-500">{col.type}</td>
            <td className="px-3.5 py-1.5 text-right">
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                + added
              </span>
            </td>
          </tr>
        ))}
        {table.droppedColumns.map((name) => (
          <tr key={`drop-${name}`} className="border-b border-neutral-100 last:border-0">
            <td className="px-3.5 py-1.5 text-neutral-900">{name}</td>
            <td className="px-3.5 py-1.5 text-neutral-500">—</td>
            <td className="px-3.5 py-1.5 text-right">
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                − removed
              </span>
            </td>
          </tr>
        ))}
        {table.typeChanges.map((change) => (
          <tr key={`type-${change.column}`} className="border-b border-neutral-100 last:border-0">
            <td className="px-3.5 py-1.5 text-neutral-900">{change.column}</td>
            <td className="px-3.5 py-1.5 text-neutral-500">
              <span className="line-through text-neutral-400">{change.before}</span>
              <span className="mx-1.5 text-neutral-300">→</span>
              <span>{change.after}</span>
            </td>
            <td className="px-3.5 py-1.5 text-right">
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                ~ type
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface DroppedTableCardProps {
  name: string;
}

const DroppedTableCard: React.FC<DroppedTableCardProps> = ({ name }) => (
  <div className="bg-white border border-rose-200 rounded-lg overflow-hidden">
    <div className="px-3.5 py-2 bg-rose-50 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      <span className="text-[12px] font-medium text-rose-900">Dropped table</span>
      <span className="text-[12px] font-mono text-rose-700">{name}</span>
    </div>
  </div>
);
