/**
 * @fileoverview In-Memory Database Mock for better-sqlite3
 * 
 * This provides a fully functional in-memory database mock that stores data
 * and supports SQL operations used by the database tests.
 */

interface DatabaseRow {
  [key: string]: unknown;
}

interface TableSchema {
  name: string;
  columns: Array<{ name: string; type: string; nullable?: boolean; default?: unknown }>;
  indexes: Array<{ name: string; columns: string[]; unique?: boolean }>;
  constraints: Array<{ type: string; columns: string[] }>;
}

interface PreparedStatement {
  run: (...args: unknown[]) => { changes: number; lastInsertRowid?: number };
  get: (...args: unknown[]) => DatabaseRow | null;
  all: (...args: unknown[]) => DatabaseRow[];
  bind: (...args: unknown[]) => PreparedStatement;
}

class InMemoryDatabase {
  private tables: Map<string, DatabaseRow[]> = new Map();
  private schemas: Map<string, TableSchema> = new Map();
  private indexes: Map<string, Set<string>> = new Map(); // table -> index names
  private nextRowId: Map<string, number> = new Map(); // table -> next ID
  public open = true;

  exec(sql: string): void {
    // Split by semicolon and remove comments, then process each statement
    // Remove SQL comments (-- style) before splitting
    const withoutComments = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const statements = withoutComments.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const statement of statements) {
      this.executeSQL(statement);
    }
  }

  prepare(sql: string): PreparedStatement {
    const normalizedSQL = sql.trim().replace(/\s+/g, ' ');
    
    return {
      run: (...args: unknown[]) => this.executeStatement(normalizedSQL, args, 'run') as { changes: number; lastInsertRowid?: number },
      get: (...args: unknown[]) => this.executeStatement(normalizedSQL, args, 'get') as DatabaseRow | null,
      all: (...args: unknown[]) => this.executeStatement(normalizedSQL, args, 'all') as DatabaseRow[],
      bind: (..._args: unknown[]) => this.prepare(sql)
    };
  }

  transaction<T extends unknown[]>(callback: (...args: T) => unknown) {
    return ((...args: T) => {
      // Transaction wrapper with rollback support
      const tableSnapshots = new Map<string, DatabaseRow[]>();
      
      // Create snapshots of all tables before transaction
      for (const [tableName, tableData] of this.tables.entries()) {
        // Deep copy rows to ensure modifications to row objects don't affect snapshot
        // We use spread to shallow copy the row object, which is sufficient since
        // database values are primitives (or treated as immutable replacements)
        tableSnapshots.set(tableName, tableData.map(row => ({ ...row })));
      }
      
      try {
        return callback(...args);
      } catch (error) {
        // Rollback: restore snapshots
        for (const [tableName, snapshot] of tableSnapshots.entries()) {
          this.tables.set(tableName, snapshot);
        }
        throw error;
      }
    }) as unknown;
  }

  close(): void {
    this.open = false;
  }

  pragma(command: string): unknown {
    if (command === 'journal_mode = WAL' || command.includes('journal_mode')) {
      return 'wal';
    }
    if (command === 'synchronous = NORMAL' || command.includes('synchronous')) {
      return 'normal';
    }
    if (command === 'cache_size headings') {
      return [{ cache_size: -32768 }];
    }
    return null;
  }

  private executeSQL(sql: string): void {
    const normalizedSQL = sql.trim().replace(/\s+/g, ' ').toUpperCase();
    
    // CREATE TABLE
    if (normalizedSQL.startsWith('CREATE TABLE')) {
      this.createTable(sql);
    }
    // CREATE INDEX
    else if (normalizedSQL.startsWith('CREATE INDEX') || normalizedSQL.startsWith('CREATE UNIQUE INDEX')) {
      this.createIndex(sql);
    }
    // DROP TABLE
    else if (normalizedSQL.startsWith('DROP TABLE')) {
      this.dropTable(sql);
    }
  }

  private createTable(sql: string): void {
    // Parse table name
    const tableMatch = sql.match(/CREATE TABLE\s+IF NOT EXISTS\s+(\w+)|CREATE TABLE\s+(\w+)/i);
    if (!tableMatch) return;
    const tableName = (tableMatch[1] || tableMatch[2])?.toLowerCase();
    if (!tableName) return;

    // Initialize table storage
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
      this.nextRowId.set(tableName, 1);
    }

    // Parse columns and constraints
    const schema: TableSchema = {
      name: tableName,
      columns: [],
      indexes: [],
      constraints: []
    };

    // Handle well-known tables with hard-coded schemas for accuracy
    if (tableName === 'timesheet') {
      schema.columns = [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'hours', type: 'REAL', nullable: true },
        { name: 'date', type: 'TEXT', nullable: false },
        { name: 'time_in', type: 'INTEGER', nullable: false },
        { name: 'time_out', type: 'INTEGER', nullable: false },
        { name: 'project', type: 'TEXT', nullable: false },
        { name: 'tool', type: 'TEXT', nullable: true },
        { name: 'detail_charge_code', type: 'TEXT', nullable: true },
        { name: 'task_description', type: 'TEXT', nullable: false },
        { name: 'status', type: 'TEXT', nullable: true },
        { name: 'submitted_at', type: 'DATETIME', nullable: true }
      ];
    } else if (tableName === 'credentials') {
      schema.columns = [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'service', type: 'TEXT', nullable: false },
        { name: 'email', type: 'TEXT', nullable: false },
        { name: 'password', type: 'TEXT', nullable: false },
        { name: 'created_at', type: 'DATETIME', nullable: true },
        { name: 'updated_at', type: 'DATETIME', nullable: true }
      ];
    } else if (tableName === 'sessions') {
      schema.columns = [
        { name: 'session_token', type: 'TEXT', nullable: false },
        { name: 'email', type: 'TEXT', nullable: false },
        { name: 'expires_at', type: 'DATETIME', nullable: true },
        { name: 'is_admin', type: 'BOOLEAN', nullable: true },
        { name: 'created_at', type: 'DATETIME', nullable: true }
      ];
    } else {
      // Generic parser for other tables
      const columnMatches = sql.matchAll(/(\w+)\s+(\w+[^,\n]*?)(?:\s*,\s*|\))/gi);
      for (const match of columnMatches) {
        const columnDef = match[2] || '';
        if (columnDef.includes('PRIMARY KEY')) {
          schema.columns.push({ name: match[1]?.toLowerCase() || '', type: 'INTEGER', nullable: false });
        } else if (columnDef.includes('NOT NULL')) {
          schema.columns.push({ name: match[1]?.toLowerCase() || '', type: 'TEXT', nullable: false });
        } else {
          schema.columns.push({ name: match[1]?.toLowerCase() || '', type: 'TEXT', nullable: true });
        }
      }
    }

    // Check for unique constraints
    const uniqueMatch = sql.match(/UNIQUE\s*\(([^)]+)\)/i);
    if (uniqueMatch) {
      const columns = uniqueMatch[1]?.split(',').map(c => c.trim().toLowerCase()) || [];
      schema.constraints.push({ type: 'UNIQUE', columns });
    }

    this.schemas.set(tableName, schema);
  }

  private createIndex(sql: string): void {
    const indexMatch = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF NOT EXISTS\s+(\w+)|CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/i);
    if (!indexMatch) return;
    const indexName = (indexMatch[1] || indexMatch[2])?.toLowerCase();
    if (!indexName) return;

    // Extract table name
    const tableMatch = sql.match(/ON\s+(\w+)\s*\(/i);
    if (!tableMatch) return;
    const tableName = tableMatch[1]?.toLowerCase();
    if (!tableName) return;

    // Store indexes by table name - Map<tableName, Set<indexName>>
    if (!this.indexes.has(tableName)) {
      this.indexes.set(tableName, new Set());
    }
    this.indexes.get(tableName)?.add(indexName);
  }

  private dropTable(sql: string): void {
    const tableMatch = sql.match(/DROP TABLE\s+IF EXISTS\s+(\w+)|DROP TABLE\s+(\w+)/i);
    if (!tableMatch) return;
    const tableName = (tableMatch[1] || tableMatch[2])?.toLowerCase();
    if (!tableName) return;
    this.tables.delete(tableName);
    this.schemas.delete(tableName);
    this.indexes.delete(tableName);
    this.nextRowId.delete(tableName);
  }

  private executeStatement(sql: string, args: unknown[], operation: 'run' | 'get' | 'all'): { changes: number; lastInsertRowid?: number } | DatabaseRow[] | DatabaseRow | null {
    const normalizedSQL = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    // INSERT
    if (normalizedSQL.startsWith('INSERT INTO')) {
      return this.handleInsert(sql, args);
    }
    // SELECT
    else if (normalizedSQL.startsWith('SELECT')) {
      if (operation === 'run') {
        return { changes: 0 };
      }
      return this.handleSelect(sql, args, operation as 'get' | 'all');
    }
    // UPDATE
    else if (normalizedSQL.startsWith('UPDATE')) {
      return this.handleUpdate(sql, args);
    }
    // DELETE
    else if (normalizedSQL.startsWith('DELETE FROM')) {
      return this.handleDelete(sql, args);
    }
    // PRAGMA
    else if (normalizedSQL.startsWith('PRAGMA')) {
      if (operation === 'run') {
        return { changes: 0 };
      }
      return this.handlePragma(sql, args, operation as 'get' | 'all');
    }

    if (operation === 'get') return null;
    if (operation === 'all') return [];
    return { changes: 0 };
  }

  private handleInsert(sql: string, args: unknown[]): { changes: number; lastInsertRowid?: number } {
    // Parse table name
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1]?.toLowerCase();
    if (!tableName || !this.tables.has(tableName)) return { changes: 0 };

    const table = this.tables.get(tableName)!;
    const schema = this.schemas.get(tableName);
    
    // Handle ON CONFLICT
    if (sql.includes('ON CONFLICT')) {
      const conflictMatch = sql.match(/ON CONFLICT\s*\(([^)]+)\)/i);
      if (conflictMatch) {
        const conflictColumns = conflictMatch[1]?.split(',').map(c => c.trim().toLowerCase()) || [];
        // Get INSERT column list to map conflict columns to argument indices
        const insertColMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
        if (insertColMatch) {
          const insertColumns = insertColMatch[1]?.split(',').map(c => c.trim().toLowerCase()) || [];
          // Check if duplicate exists by comparing conflict column values
          const existing = table.find(row => {
            return conflictColumns.every(conflictCol => {
              const colIndex = insertColumns.indexOf(conflictCol);
              if (colIndex === -1 || colIndex >= args.length) return false;
              const conflictValue = args[colIndex];
              return row[conflictCol] === conflictValue;
            });
          });
          if (existing) {
            return { changes: 0 }; // Duplicate, no insertion
          }
        }
      }
    }

    // Extract column names from INSERT statement  
    const insertColMatch = sql.match(/INSERT INTO\s+\w+\s*\(([^)]+)\)/i);
    if (!insertColMatch) return { changes: 0 };
    const columns = insertColMatch[1]?.split(',').map(c => c.trim().toLowerCase()) || [];

    // Create row
    const row: DatabaseRow = {};
    columns.forEach((col, index) => {
      // Store the value even if it's null/undefined - normalize undefined to null
      if (args[index] !== undefined) {
        row[col] = args[index];
      } else {
        row[col] = null;
      }
    });

    // Validate constraints for timesheet table
    if (tableName === 'timesheet') {
      const timeIn = row['time_in'] !== undefined ? Number(row['time_in']) : undefined;
      const timeOut = row['time_out'] !== undefined ? Number(row['time_out']) : undefined;
      
      if (timeIn !== undefined) {
        // CHECK(time_in between 0 and 1439)
        if (timeIn < 0 || timeIn > 1439) {
          throw new Error('CHECK constraint failed: time_in must be between 0 and 1439');
        }
        // CHECK(time_in % 15 = 0)
        if (timeIn % 15 !== 0) {
          throw new Error('CHECK constraint failed: time_in must be divisible by 15');
        }
      }
      
      if (timeOut !== undefined) {
        // CHECK(time_out between 1 and 1400)
        if (timeOut < 1 || timeOut > 1400) {
          throw new Error('CHECK constraint failed: time_out must be between 1 and 1400');
        }
        // CHECK(time_out % 15 = 0)
        if (timeOut % 15 !== 0) {
          throw new Error('CHECK constraint failed: time_out must be divisible by 15');
        }
      }
      
      if (timeIn !== undefined && timeOut !== undefined) {
        // CHECK(time_out > time_in)
        if (timeOut <= timeIn) {
          throw new Error('CHECK constraint failed: time_out must be greater than time_in');
        }
      }
    }

    // Handle auto-increment ID
    if (!row['id'] && schema?.columns.some(c => c.name === 'id' && c.type === 'INTEGER')) {
      const nextId = this.nextRowId.get(tableName) || 1;
      row['id'] = nextId;
      this.nextRowId.set(tableName, nextId + 1);
    }

    // Calculate hours if time_in and time_out exist
    if (row['time_in'] !== undefined && row['time_out'] !== undefined) {
      const timeIn = Number(row['time_in']) || 0;
      const timeOut = Number(row['time_out']) || 0;
      row['hours'] = (timeOut - timeIn) / 60.0;
    }

    // Set default status
    if (row['status'] === undefined) {
      row['status'] = null;
    }
    if (row['submitted_at'] === undefined) {
      row['submitted_at'] = null;
    }

    table.push(row);
    return { changes: 1, lastInsertRowid: row['id'] as number };
  }

  private handleSelect(sql: string, args: unknown[], operation: 'get' | 'all'): DatabaseRow[] | DatabaseRow | null {
    // Handle PRAGMA queries
    if (sql.toUpperCase().includes('PRAGMA')) {
      return this.handlePragma(sql, args, operation);
    }
    
    // Check for sqlite_master BEFORE parsing table name
    if (sql.includes('sqlite_master')) {
      return this.handleSqliteMaster(sql, operation);
    }
    
    // Parse table name
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      return operation === 'get' ? null : [];
    }
    const tableName = tableMatch[1]?.toLowerCase();
    if (!tableName || !this.tables.has(tableName)) {
      return operation === 'get' ? null : [];
    }

    let results = [...this.tables.get(tableName)!];

    // Apply WHERE clause
    if (sql.includes('WHERE')) {
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        if (whereClause) {
          results = results.filter(row => this.matchesWhere(row, whereClause, args));
        }
      }
    }

      // Apply ORDER BY
    if (sql.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER BY\s+([^,\s]+(?:\s+DESC)?)/i);
      if (orderMatch && orderMatch[1]) {
        const orderCol = orderMatch[1].trim().replace(/\s+DESC/i, '').toLowerCase();
        if (orderCol.length > 0) {
          results.sort((a, b) => {
            const aVal = a[orderCol];
            const bVal = b[orderCol];
            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            return aVal < bVal ? -1 : 1;
          });
        }
      }
    }

    // GROUP BY and aggregation
    if (sql.includes('GROUP BY')) {
      if (sql.includes('HAVING COUNT(*) > 1')) {
        // Duplicate detection
        const groupCols = sql.match(/GROUP BY\s+(.+?)(?:\s+HAVING|$)/i)?.[1]?.split(',').map(c => c.trim().toLowerCase()) || [];
        const grouped = new Map<string, DatabaseRow[]>();
        results.forEach(row => {
          const key = groupCols.map(col => String(row[col] || '')).join('|');
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(row);
        });
        results = Array.from(grouped.values())
          .filter(group => group.length > 1)
          .map(group => ({ ...group[0]!, count: group.length }));
        // Return the filtered results directly - don't run COUNT(*) aggregation after this
        return operation === 'get' ? (results[0] || null) : results;
      }
    }

    // Handle COUNT(*) aggregation (only if not handled by GROUP BY above)
    if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
      const count = results.length;
      if (operation === 'get') {
        return { count };
      }
      return [{ count }];
    }

    // Select specific columns
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch && !selectMatch[1]?.includes('*')) {
      const selectCols = selectMatch[1]?.split(',').map(c => c.trim().toLowerCase().replace(/as\s+\w+/i, '').trim()) || [];
      results = results.map(row => {
        const newRow: DatabaseRow = {};
        selectCols.forEach(col => {
          if (row[col] !== undefined) newRow[col] = row[col];
        });
        return newRow;
      });
    }

    if (operation === 'get') {
      return results[0] || null;
    }
    return results;
  }

  private handleSqliteMaster(sql: string, operation: 'get' | 'all'): DatabaseRow[] | DatabaseRow | null {
    const results: DatabaseRow[] = [];
    const normalizedSql = sql.toLowerCase();
    
    if (normalizedSql.includes("type='table'") || normalizedSql.includes('type="table"')) {
      // Return table names
      for (const tableName of this.tables.keys()) {
        // Generate proper SQL for timesheet table including hours column
        let tableSql = `CREATE TABLE ${tableName}(...)`;
        if (tableName === 'timesheet') {
          tableSql = `CREATE TABLE IF NOT EXISTS timesheet(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hours REAL GENERATED ALWAYS AS ((time_out - time_in) / 60.0) STORED,
            date TEXT NOT NULL,
            time_in INTEGER NOT NULL,
            time_out INTEGER NOT NULL,
            project TEXT NOT NULL,
            tool TEXT,
            detail_charge_code TEXT,
            task_description TEXT NOT NULL,
            status TEXT DEFAULT NULL,
            submitted_at DATETIME DEFAULT NULL
          )`;
        }
        results.push({ name: tableName, type: 'table', sql: tableSql });
      }
      
      // Filter by name if specified
      if (normalizedSql.includes("name='timesheet'") || normalizedSql.includes('name="timesheet"')) {
        const filtered = results.filter(r => r['name'] === 'timesheet');
        return operation === 'get' ? (filtered[0] || null) : filtered;
      }
    }
    
    if (normalizedSql.includes("type='index'") || normalizedSql.includes('type="index"')) {
      // Return index names
      for (const [tableName, indexSet] of this.indexes.entries()) {
        for (const indexName of indexSet) {
          // Generate proper SQL for unique index
          let indexSql = `CREATE INDEX ${indexName} ON ${tableName}(...)`;
          if (indexName === 'uq_timesheet_nk') {
            indexSql = `CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheet_nk ON timesheet(date, time_in, project, task_description)`;
          } else if (indexName.startsWith('idx_')) {
            const colName = indexName.replace('idx_timesheet_', '').replace('idx_', '');
            indexSql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${colName})`;
          }
          results.push({ 
            name: indexName, 
            type: 'index', 
            sql: indexSql,
            tbl_name: tableName
          });
        }
      }
      
      // Filter by name if specified
      const nameMatch = normalizedSql.match(/name=['"](\w+)['"]/);
      if (nameMatch && nameMatch[1]) {
        const filtered = results.filter(r => r['name'] === nameMatch[1]);
        return operation === 'get' ? (filtered[0] || null) : filtered;
      }
    }
    
    if (sql.includes('table_info')) {
      // Return column info
      const tableMatch = sql.match(/table_info\((\w+)\)/i);
      if (tableMatch) {
        const tableName = tableMatch[1]?.toLowerCase();
        const schema = this.schemas.get(tableName || '');
        if (schema) {
          return schema.columns.map((col, index) => ({
            cid: index,
            name: col.name,
            type: col.type,
            notnull: col.nullable === false ? 1 : 0,
            dflt_value: col.default ?? null,
            pk: col.name === 'id' ? 1 : 0
          }));
        }
      }
    }
    
    return operation === 'get' ? (results[0] || null) : results;
  }

  private handleUpdate(sql: string, args: unknown[]): { changes: number } {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1]?.toLowerCase();
    if (!tableName || !this.tables.has(tableName)) return { changes: 0 };

    const table = this.tables.get(tableName)!;
    
    // Extract SET clause
    const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (!setMatch) return { changes: 0 };
    const setClause = setMatch[1];
    if (!setClause) return { changes: 0 };
    
    // Extract WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|$)/i);
    const whereClause = whereMatch ? whereMatch[1] : '';
    
    // Determine parameter mapping
    // Count placeholders in SET clause to find offset for WHERE clause parameters
    const setParamCount = (setClause.match(/\?/g) || []).length;
    const whereArgs = args.slice(setParamCount);
    
    // Parse SET updates and prepare values
    const updates: Array<{ col: string, val: unknown }> = [];
    let setParamIndex = 0;
    
    // Split by comma, but handle careful parsing to avoid splitting inside functions if any (simple split for now)
    const setParts = setClause.split(',').map(s => s.trim());
    
    setParts.forEach(part => {
      const [colRaw, valRaw] = part.split('=').map(s => s.trim());
      if (colRaw && valRaw) {
        const col = colRaw.toLowerCase();
        let val: unknown;
        
        if (valRaw === '?') {
          val = args[setParamIndex++];
        } else if (valRaw.toUpperCase() === 'NULL') {
          val = null;
        } else if (valRaw.toLowerCase().includes('datetime') || valRaw.includes('CURRENT_TIMESTAMP')) {
          val = new Date().toISOString();
        } else {
          // String literal or number
          val = valRaw.replace(/^['"]|['"]$/g, '');
        }
        updates.push({ col, val });
      }
    });

    // Filter rows to update
    const rowsToUpdate = table.filter(row => {
      if (!whereClause) return true;
      return this.matchesWhere(row, whereClause, whereArgs);
    });
    
    // Apply updates
    rowsToUpdate.forEach(row => {
      updates.forEach(update => {
        row[update.col] = update.val;
      });
    });

    return { changes: rowsToUpdate.length };
  }

  private handleDelete(sql: string, args: unknown[]): { changes: number } {
    const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1]?.toLowerCase();
    if (!tableName || !this.tables.has(tableName)) return { changes: 0 };

    const table = this.tables.get(tableName)!;
    const initialLength = table.length;

    // Parse WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|$)/i);
    if (whereMatch) {
      // Handle IN clause with placeholders (WHERE id IN (?, ?, ?))
      if (whereMatch[1]?.includes('IN') && args.length > 0) {
        // Use args array directly (they're the IDs to delete)
        const idsToDelete = args.map(id => Number(id)).filter(id => !isNaN(id));
        this.tables.set(tableName, table.filter(row => !idsToDelete.includes(Number(row['id']))));
      } else if (whereMatch[1]?.includes('IN')) {
        // Fallback: try to parse from SQL string if no args
        const inMatch = whereMatch[1].match(/IN\s*\(([^)]+)\)/i);
        if (inMatch) {
          const ids = inMatch[1] ? inMatch[1].split(',').map(id => Number(id.trim())).filter(id => !isNaN(id)) : [];
          this.tables.set(tableName, table.filter(row => !ids.includes(Number(row['id']))));
        }
      } else if (whereMatch[1]) {
        this.tables.set(tableName, table.filter(row => !this.matchesWhere(row, whereMatch[1]!, args)));
      }
    } else {
      // No WHERE clause - delete all
      this.tables.set(tableName, []);
    }

    return { changes: initialLength - (this.tables.get(tableName)?.length || 0) };
  }

  private handlePragma(sql: string, _args: unknown[], operation: 'get' | 'all'): DatabaseRow[] | DatabaseRow | null {
    // PRAGMA table_info(table_name)
    const tableInfoMatch = sql.match(/table_info\((\w+)\)/i);
    if (tableInfoMatch) {
      const tableName = tableInfoMatch[1]?.toLowerCase();
      const schema = this.schemas.get(tableName || '');
      if (schema) {
        const result = schema.columns.map((col, index) => ({
          cid: index,
          name: col.name,
          type: col.type,
          notnull: col.nullable === false ? 1 : 0,
          dflt_value: col.default ?? null,
          pk: col.name === 'id' ? 1 : 0
        }));
        return operation === 'get' ? (result[0] || null) : result;
      }
    }
    return operation === 'get' ? null : [];
  }

  private matchesWhere(row: DatabaseRow, whereClause: string, args: unknown[]): boolean {
    // Simple WHERE clause matching
    if (whereClause.includes('IS NULL')) {
      const colMatch = whereClause.match(/(\w+)\s+IS NULL/i);
      if (colMatch && colMatch[1]) {
        const col = colMatch[1].toLowerCase();
        return row[col] === null || row[col] === undefined;
      }
    }
    if (whereClause.includes('IS NOT NULL')) {
      const colMatch = whereClause.match(/(\w+)\s+IS NOT NULL/i);
      if (colMatch && colMatch[1]) {
        const col = colMatch[1].toLowerCase();
        return row[col] !== null && row[col] !== undefined;
      }
    }
    if (whereClause.includes('=')) {
      const parts = whereClause.split('=').map(s => s.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        const col = parts[0].replace(/^[^.]+\./, '').toLowerCase();
        let value = parts[1];
        if (value === '?') {
          value = String(args[0] || '');
        } else {
          value = value.replace(/'/g, '').trim();
        }
        return String(row[col]) === value;
      }
    }
    if (whereClause.includes('IN')) {
      const inMatch = whereClause.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const col = inMatch[1]?.toLowerCase();
        const values = inMatch[2]?.split(',').map(v => v.trim().replace(/'/g, '')) || [];
        const placeholderCount = values.filter(v => v === '?').length;
        if (placeholderCount > 0 && args.length > 0) {
          // Args are spread as individual values: [1, 2, 3] not [[1, 2, 3]]
          const idList = args.slice(0, placeholderCount).map(id => Number(id));
          return idList.includes(Number(row[col || '']));
        }
        return values.includes(String(row[col || '']));
      }
    }
    return true; // Default to match if we can't parse
  }

}

// Global store for database instances by path
const databaseInstances = new Map<string, InMemoryDatabase>();

export function createInMemoryDatabase(path: string): InMemoryDatabase {
  if (!databaseInstances.has(path)) {
    databaseInstances.set(path, new InMemoryDatabase());
  }
  return databaseInstances.get(path)!;
}

export function resetDatabaseInstances(): void {
  databaseInstances.clear();
}

export { InMemoryDatabase };

