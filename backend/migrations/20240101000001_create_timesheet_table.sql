-- Create timesheet table
CREATE TABLE IF NOT EXISTS timesheet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time_in INTEGER NOT NULL,
    time_out INTEGER NOT NULL,
    hours REAL NOT NULL,
    project TEXT NOT NULL,
    tool TEXT,
    detail_charge_code TEXT,
    task_description TEXT NOT NULL,
    status TEXT,
    submitted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, time_in, project, task_description)
);

