import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import './DatabaseViewer.css';

import { HotTable } from '@handsontable/react-wrapper';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { registerAllModules } from 'handsontable/registry';
import { memo,useEffect, useMemo, useState } from 'react';

import { useData } from '../../contexts/DataContext';
import { StatusButton } from '../StatusButton';

type ButtonStatus = 'neutral' | 'ready' | 'warning';

// Register Handsontable modules
registerAllModules();

interface TimesheetEntry {
  id: number;
  date: string;
  time_in: number;
  time_out: number;
  hours: number;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

interface Credential {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// interface DatabaseData {
//   timesheet: TimesheetEntry[];
//   credentials: Credential[];
// }

function Archive() {
  window.logger?.debug('[Archive] Component rendering');
  const [activeTab] = useState<'timesheet' | 'credentials'>('timesheet');
  const [isExporting, setIsExporting] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Use shared DataContext instead of local state
  const { archiveData, isArchiveDataLoading, archiveDataError, refreshArchiveData } = useData();

  // Fetch fresh data when component mounts
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      window.logger?.debug('[Archive] Component mounted, refreshing archive data');
      if (isMounted) {
        await refreshArchiveData();
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshArchiveData]);

  window.logger?.debug('[Archive] Component state', {
    isLoading: isArchiveDataLoading,
    error: archiveDataError,
    timesheetCount: archiveData.timesheet.length,
    credentialsCount: archiveData.credentials.length,
  });

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    // Convert from YYYY-MM-DD to MM/DD/YYYY format
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        // YYYY-MM-DD -> MM/DD/YYYY
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
      }
    }
    // Return as-is if not in expected format
    return dateStr;
  };

  const formatTimesheetData = (entries: TimesheetEntry[]) => {
    const formatted = entries.map((entry) => ({
      date: formatDate(entry.date),
      timeIn: formatTime(entry.time_in),
      timeOut: formatTime(entry.time_out),
      hours: entry.hours.toFixed(2),
      project: entry.project,
      tool: entry.tool || '',
      chargeCode: entry.detail_charge_code || '',
      taskDescription: entry.task_description,
    }));
    window.logger?.verbose('[Archive] Formatted timesheet data', {
      entryCount: formatted.length,
    });
    return formatted;
  };

  const formatCredentialsData = (credentials: Credential[]) => {
    return credentials.map((cred) => ({
      service: cred.service,
      email: cred.email,
      createdAt: cred.created_at,
      updatedAt: cred.updated_at,
    }));
  };

  const timesheetColumns = [
    { data: 'date', title: 'Date', width: 100 },
    { data: 'timeIn', title: 'Time In', width: 80 },
    { data: 'timeOut', title: 'Time Out', width: 80 },
    { data: 'hours', title: 'Hours', width: 70 },
    { data: 'project', title: 'Project', width: 120 },
    { data: 'tool', title: 'Tool', width: 100 },
    { data: 'chargeCode', title: 'Detail Charge Code', width: 120 },
    { data: 'taskDescription', title: 'Task Description', width: 200 },
  ];

  const credentialsColumns = [
    { data: 'service', title: 'Service', width: 120 },
    { data: 'email', title: 'Email', width: 200 },
    { data: 'createdAt', title: 'Created', width: 150 },
    { data: 'updatedAt', title: 'Updated', width: 150 },
  ];

  const handleManualRefresh = async () => {
    // Prevent multiple simultaneous refreshes
    if (isManualRefreshing || isArchiveDataLoading) return;

    window.logger?.userAction('archive-manual-refresh-clicked');
    setIsManualRefreshing(true);

    try {
      await refreshArchiveData();
      window.logger?.info('Archive data manually refreshed');
    } catch (error) {
      window.logger?.error('Manual refresh error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const exportToCSV = async () => {
    // Prevent multiple simultaneous exports
    if (isExporting) return;

    window.logger?.userAction('export-to-csv-clicked');
    setIsExporting(true);

    try {
      // CSV export functionality not yet implemented
      window.logger?.info('CSV export requested');
    } catch (error) {
      window.logger?.error('CSV export error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsExporting(false);
    }
  };

  // Validate archive data for button status - MUST be before early returns
  const buttonStatus: ButtonStatus = useMemo(() => {
    if (archiveData.timesheet.length === 0) {
      return 'neutral';
    }
    return 'ready';
  }, [archiveData.timesheet.length]);

  if (isArchiveDataLoading) {
    return (
      <div className="loading-container">
        <h3 className="md-typescale-title-large">Loading archive...</h3>
      </div>
    );
  }

  if (archiveDataError) {
    return (
      <div className="error-container">
        <h3 className="md-typescale-title-large">Error loading archive</h3>
        <p className="md-typescale-body-large archive-error-message">{archiveDataError}</p>
      </div>
    );
  }

  return (
    <div className="archive-page">
      <div className="archive-header">
        <Tooltip title="Refresh archive data" placement="bottom">
          <span>
            <IconButton
              onClick={handleManualRefresh}
              disabled={isManualRefreshing || isArchiveDataLoading}
              aria-label="refresh archive"
              sx={{
                color: 'var(--md-sys-color-on-surface)',
                '&:hover': {
                  backgroundColor: 'var(--md-sys-color-surface-variant)',
                },
                '&:disabled': {
                  color: 'var(--md-sys-color-on-surface)',
                  opacity: 0.38,
                },
              }}
            >
              {isManualRefreshing || isArchiveDataLoading ? (
                <CircularProgress size={24} sx={{ color: 'var(--md-sys-color-primary)' }} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </div>
      {archiveData.timesheet.length === 0 && archiveData.credentials.length === 0 ? (
        <div className="no-data-message">
          <p>No data available. Submit some timesheet entries to see them here.</p>
          <p>Timesheet entries: {archiveData.timesheet.length}</p>
          <p>Credentials: {archiveData.credentials.length}</p>
        </div>
      ) : activeTab === 'timesheet' ? (
        <HotTable
          data={formatTimesheetData(archiveData.timesheet)}
          columns={timesheetColumns}
          colHeaders={true}
          rowHeaders={true}
          stretchH="all"
          themeName="ht-theme-horizon"
          licenseKey="non-commercial-and-evaluation"
          width="100%"
          readOnly={true}
          disableVisualSelection={true}
          contextMenu={false}
          fillHandle={false}
          outsideClickDeselects={true}
          currentRowClassName=""
          currentColClassName=""
          activeHeaderClassName=""
        />
      ) : (
        <HotTable
          data={formatCredentialsData(archiveData.credentials)}
          columns={credentialsColumns}
          colHeaders={true}
          rowHeaders={true}
          stretchH="all"
          themeName="ht-theme-horizon"
          licenseKey="non-commercial-and-evaluation"
          width="100%"
          readOnly={true}
          disableVisualSelection={true}
          contextMenu={false}
          fillHandle={false}
          outsideClickDeselects={true}
          currentRowClassName=""
          currentColClassName=""
          activeHeaderClassName=""
        />
      )}
      <div className="archive-footer">
        <StatusButton
          status={buttonStatus}
          onClick={exportToCSV}
          isProcessing={isExporting}
          processingText="Exporting..."
          icon={<DownloadIcon />}
        >
          Export to CSV
        </StatusButton>
      </div>
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(Archive);
