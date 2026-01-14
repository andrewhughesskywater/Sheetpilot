interface TimesheetGridLoadingStateProps {
  isLoading: boolean;
  error: string | null;
}

export default function TimesheetGridLoadingState({ isLoading, error }: TimesheetGridLoadingStateProps) {
  if (isLoading) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large">Loading draft data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large timesheet-error-message">
          Error loading timesheet data: {error}
        </p>
      </div>
    );
  }

  return null;
}
