import React, { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import { useData } from '../contexts/DataContext';
import './DatabaseViewer.css';

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

const Archive: React.FC = () => {
  const [activeTab] = useState<'timesheet' | 'credentials'>('timesheet');
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Use preloaded data from context
  const { 
    archiveData, 
    isArchiveDataLoading, 
    archiveDataError 
  } = useData();


  // No need for loadData function or useEffect hooks since data is preloaded

  // Measure grid available height
  useEffect(() => {
    const measure = () => {
      if (!gridContainerRef.current) {
        return;
      }
      const rect = gridContainerRef.current.getBoundingClientRect();
      const available = Math.max(200, Math.floor(window.innerHeight - rect.top - 20));
      // Set CSS custom property directly
      gridContainerRef.current.style.setProperty('--grid-height', `${available}px`);
    };

    // measure after mount and after layout
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
    };
  }, [activeTab]);

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatTimesheetData = (entries: TimesheetEntry[]) => {
    const formatted = entries.map(entry => ({
      date: entry.date,
      timeIn: formatTime(entry.time_in),
      timeOut: formatTime(entry.time_out),
      hours: entry.hours.toFixed(2),
      project: entry.project,
      tool: entry.tool || '',
      chargeCode: entry.detail_charge_code || '',
      taskDescription: entry.task_description
    }));
    console.log('[Archive] Formatted timesheet data:', formatted);
    return formatted;
  };

  const formatCredentialsData = (credentials: Credential[]) => {
    return credentials.map(cred => ({
      id: cred.id,
      service: cred.service,
      email: cred.email,
      createdAt: cred.created_at,
      updatedAt: cred.updated_at
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
    { data: 'taskDescription', title: 'Task Description', width: 200 }
  ];

  const credentialsColumns = [
    { data: 'id', title: 'ID', width: 60 },
    { data: 'service', title: 'Service', width: 120 },
    { data: 'email', title: 'Email', width: 200 },
    { data: 'createdAt', title: 'Created', width: 150 },
    { data: 'updatedAt', title: 'Updated', width: 150 }
  ];

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
        <p className="md-typescale-body-large archive-error-message">
          {archiveDataError}
        </p>
      </div>
    );
  }

  return (
    <div className="main-container">
      <div className="header-container">
        <h2 className="md-typescale-headline-medium">Archive</h2>
        <div>
          <span className="data-info md-typescale-body-medium">
            Timesheet entries: {archiveData.timesheet.length} | 
            Credentials: {archiveData.credentials.length}
          </span>
        </div>
      </div>

      <div ref={gridContainerRef} className="grid-container">
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
            height={400}
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
            height={400}
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
      </div>
    </div>
  );
};

export default Archive;
