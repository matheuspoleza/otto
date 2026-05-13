import { describe, expect, it } from 'vitest';
import {
  buildDataChanges,
  createEmptyParsed,
  parseColumnDefinition,
  parseMigrationSQL,
  type ParsedSQL,
} from './data';

describe('parseMigrationSQL', () => {
  describe('Given an empty migration string', () => {
    it('then returns an empty ParsedSQL', () => {
      const result = parseMigrationSQL('');
      expect(result.newEnums).toEqual([]);
      expect(result.newTables).toEqual([]);
      expect(result.droppedTables).toEqual([]);
      expect(result.modifiedTables.size).toBe(0);
      expect(result.foreignKeys).toEqual([]);
    });
  });

  describe('Given a migration with only SQL line comments', () => {
    it('then no statements are recorded', () => {
      const sql = `-- CreateTable\n-- nothing actually defined here\n`;
      const result = parseMigrationSQL(sql);
      expect(result.newTables).toEqual([]);
      expect(result.newEnums).toEqual([]);
    });
  });

  describe('Given a CREATE TYPE enum', () => {
    describe('When parsed', () => {
      it('then captures the enum name and values in order', () => {
        const sql = `CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');`;
        const result = parseMigrationSQL(sql);
        expect(result.newEnums).toEqual([
          { name: 'Priority', values: ['LOW', 'MEDIUM', 'HIGH'] },
        ]);
      });
    });

    describe('When the migration has multiple enums', () => {
      it('then captures each enum independently', () => {
        const sql = `
          CREATE TYPE "Status" AS ENUM ('A', 'B');
          CREATE TYPE "Feature" AS ENUM ('X', 'Y', 'Z');
        `;
        const result = parseMigrationSQL(sql);
        expect(result.newEnums).toHaveLength(2);
        expect(result.newEnums[0].name).toBe('Status');
        expect(result.newEnums[1].values).toEqual(['X', 'Y', 'Z']);
      });
    });
  });

  describe('Given a CREATE TABLE with simple typed columns', () => {
    describe('When parsed', () => {
      const sql = `
        CREATE TABLE "Task" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
        );
      `;

      it('then captures the table name', () => {
        const result = parseMigrationSQL(sql);
        expect(result.newTables).toHaveLength(1);
        expect(result.newTables[0].name).toBe('Task');
      });

      it('then captures each column with name and type', () => {
        const result = parseMigrationSQL(sql);
        const cols = result.newTables[0].columns;
        expect(cols.map((c) => c.name)).toEqual(['id', 'title', 'description']);
        expect(cols.map((c) => c.type)).toEqual(['text', 'text', 'text']);
      });

      it('then marks NOT NULL columns as non-nullable', () => {
        const result = parseMigrationSQL(sql);
        const cols = result.newTables[0].columns;
        expect(cols.find((c) => c.name === 'id')?.nullable).toBe(false);
        expect(cols.find((c) => c.name === 'title')?.nullable).toBe(false);
      });

      it('then marks columns without NOT NULL as nullable', () => {
        const result = parseMigrationSQL(sql);
        const cols = result.newTables[0].columns;
        expect(cols.find((c) => c.name === 'description')?.nullable).toBe(true);
      });

      it('then marks PRIMARY KEY columns via the table constraint', () => {
        const result = parseMigrationSQL(sql);
        const cols = result.newTables[0].columns;
        expect(cols.find((c) => c.name === 'id')?.isPrimaryKey).toBe(true);
        expect(cols.find((c) => c.name === 'title')?.isPrimaryKey).toBeUndefined();
      });
    });
  });

  describe('Given a column with a quoted custom type', () => {
    it('then preserves the type case (treats it as a custom enum)', () => {
      const sql = `
        CREATE TABLE "Subscription" (
          "id" TEXT NOT NULL,
          "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
          CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
        );
      `;
      const result = parseMigrationSQL(sql);
      const status = result.newTables[0].columns.find((c) => c.name === 'status');
      expect(status?.type).toBe("SubscriptionStatus default 'TRIALING'");
    });
  });

  describe('Given a column with a numeric DEFAULT value', () => {
    it('then appends the default to the displayType', () => {
      const sql = `
        CREATE TABLE "Plan" (
          "id" TEXT NOT NULL,
          "credits" INTEGER NOT NULL DEFAULT 100,
          CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
        );
      `;
      const result = parseMigrationSQL(sql);
      const credits = result.newTables[0].columns.find((c) => c.name === 'credits');
      expect(credits?.type).toBe('integer default 100');
    });
  });

  describe('Given a column with CURRENT_TIMESTAMP default', () => {
    it('then does NOT include the default in displayType (visual noise)', () => {
      const sql = `
        CREATE TABLE "Log" (
          "id" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
        );
      `;
      const result = parseMigrationSQL(sql);
      const createdAt = result.newTables[0].columns.find((c) => c.name === 'createdAt');
      expect(createdAt?.type).toBe('timestamp(3)');
    });
  });

  describe('Given a parenthesized type like TIMESTAMP(3) or NUMERIC(10,2)', () => {
    it('then preserves the parenthesized form', () => {
      const sql = `
        CREATE TABLE "Money" (
          "id" TEXT NOT NULL,
          "amount" NUMERIC(10,2) NOT NULL,
          "at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Money_pkey" PRIMARY KEY ("id")
        );
      `;
      const result = parseMigrationSQL(sql);
      const cols = result.newTables[0].columns;
      expect(cols.find((c) => c.name === 'amount')?.type).toBe('numeric(10,2)');
      expect(cols.find((c) => c.name === 'at')?.type).toBe('timestamp(3)');
    });
  });

  describe('Given an ALTER TABLE ADD CONSTRAINT FOREIGN KEY after CREATE TABLE', () => {
    const sql = `
      CREATE TABLE "Subscription" (
        "id" TEXT NOT NULL,
        "workspaceId" TEXT NOT NULL,
        CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
      );
      ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
    `;

    it('then captures the foreign key entry', () => {
      const result = parseMigrationSQL(sql);
      expect(result.foreignKeys).toEqual([
        { table: 'Subscription', column: 'workspaceId', references: 'Workspace.id' },
      ]);
    });

    it('then applies the foreignKey reference to the matching column', () => {
      const result = parseMigrationSQL(sql);
      const col = result.newTables[0].columns.find((c) => c.name === 'workspaceId');
      expect(col?.foreignKey).toBe('Workspace.id');
    });
  });

  describe('Given ALTER TABLE ADD COLUMN', () => {
    it('then records the added column on a modifiedTables entry', () => {
      const sql = `ALTER TABLE "Task" ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'NONE';`;
      const result = parseMigrationSQL(sql);
      const mod = result.modifiedTables.get('Task');
      expect(mod).toBeDefined();
      expect(mod?.addedColumns).toHaveLength(1);
      expect(mod?.addedColumns[0].name).toBe('priority');
      expect(mod?.addedColumns[0].type).toBe("TaskPriority default 'NONE'");
      expect(mod?.addedColumns[0].nullable).toBe(false);
    });
  });

  describe('Given ALTER TABLE DROP COLUMN', () => {
    it('then records the column name on droppedColumns', () => {
      const sql = `ALTER TABLE "Task" DROP COLUMN "legacy_status";`;
      const result = parseMigrationSQL(sql);
      const mod = result.modifiedTables.get('Task');
      expect(mod?.droppedColumns).toEqual(['legacy_status']);
    });
  });

  describe('Given a DROP TABLE statement', () => {
    it('then records the table name on droppedTables', () => {
      const sql = `DROP TABLE "LegacyOrders";`;
      const result = parseMigrationSQL(sql);
      expect(result.droppedTables).toEqual(['LegacyOrders']);
    });
  });

  describe('Given a CREATE INDEX statement', () => {
    it('then ignores it (no fields touched)', () => {
      const sql = `CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");`;
      const result = parseMigrationSQL(sql);
      expect(result.newTables).toEqual([]);
      expect(result.modifiedTables.size).toBe(0);
    });
  });
});

describe('parseColumnDefinition', () => {
  describe('Given a malformed input without a quoted name', () => {
    it('then returns null', () => {
      expect(parseColumnDefinition('TEXT NOT NULL')).toBeNull();
    });
  });

  describe('Given a simple typed column', () => {
    it('then returns the parsed column with nullable default to true', () => {
      const result = parseColumnDefinition('"name" TEXT');
      expect(result).toEqual({ name: 'name', type: 'text', nullable: true });
    });
  });

  describe('Given a quoted custom type with default', () => {
    it('then preserves type case and appends the default', () => {
      const result = parseColumnDefinition('"status" "SubStatus" NOT NULL DEFAULT \'X\'');
      expect(result?.type).toBe("SubStatus default 'X'");
      expect(result?.nullable).toBe(false);
    });
  });
});

describe('buildDataChanges', () => {
  describe('Given a fully empty parsed result', () => {
    it('then returns zero count, empty description, no warning, reversible', () => {
      const result = buildDataChanges(createEmptyParsed());
      expect(result.count).toBe(0);
      expect(result.description).toBe('');
      expect(result.warning).toBeNull();
      expect(result.isReversible).toBe(true);
    });
  });

  describe('Given a single new table', () => {
    it('then description uses the singular form and includes the name', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        newTables: [{ name: 'Task', columns: [] }],
      };
      const result = buildDataChanges(parsed);
      expect(result.description).toBe('Adds 1 new table (Task).');
      expect(result.count).toBe(1);
    });
  });

  describe('Given two new tables and two new enums', () => {
    it('then description combines both additions in one sentence', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        newTables: [
          { name: 'Subscription', columns: [] },
          { name: 'AIUsageEvent', columns: [] },
        ],
        newEnums: [
          { name: 'SubscriptionStatus', values: ['A'] },
          { name: 'AIFeature', values: ['B'] },
        ],
      };
      expect(buildDataChanges(parsed).description).toBe(
        'Adds 2 new tables (Subscription and AIUsageEvent) and 2 new enums (SubscriptionStatus and AIFeature).',
      );
    });
  });

  describe('Given 4 or more new tables', () => {
    it('then description omits the name list', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        newTables: [
          { name: 'A', columns: [] },
          { name: 'B', columns: [] },
          { name: 'C', columns: [] },
          { name: 'D', columns: [] },
        ],
      };
      expect(buildDataChanges(parsed).description).toBe('Adds 4 new tables.');
    });
  });

  describe('Given a modified table with added columns', () => {
    it('then description says it modifies one table', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        modifiedTables: new Map([
          [
            'Task',
            { name: 'Task', addedColumns: [{ name: 'p', type: 'text' }], droppedColumns: [], typeChanges: [] },
          ],
        ]),
      };
      const result = buildDataChanges(parsed);
      expect(result.description).toBe('Modifies 1 table.');
      expect(result.isReversible).toBe(true);
      expect(result.warning).toBeNull();
    });
  });

  describe('Given a dropped table', () => {
    it('then marks the change as non-reversible with a destructive warning', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        droppedTables: ['LegacyOrders'],
      };
      const result = buildDataChanges(parsed);
      expect(result.isReversible).toBe(false);
      expect(result.warning).toMatch(/drops tables/i);
    });
  });

  describe('Given a dropped column (no dropped tables)', () => {
    it('then non-reversible with a column-loss warning', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        modifiedTables: new Map([
          ['Task', { name: 'Task', addedColumns: [], droppedColumns: ['legacy'], typeChanges: [] }],
        ]),
      };
      const result = buildDataChanges(parsed);
      expect(result.isReversible).toBe(false);
      expect(result.warning).toMatch(/drops columns/i);
    });
  });

  describe('Given a type change (no drops)', () => {
    it('then non-reversible with a type-change warning', () => {
      const parsed: ParsedSQL = {
        ...createEmptyParsed(),
        modifiedTables: new Map([
          [
            'Task',
            {
              name: 'Task',
              addedColumns: [],
              droppedColumns: [],
              typeChanges: [{ column: 'priority', before: 'int', after: 'text' }],
            },
          ],
        ]),
      };
      const result = buildDataChanges(parsed);
      expect(result.isReversible).toBe(false);
      expect(result.warning).toMatch(/changes column types/i);
    });
  });
});
