import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpdateDialog from '../../src/components/UpdateDialog';

describe('UpdateDialog', () => {
  it('should render when open', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        progress={50}
        status="downloading"
      />
    );

    expect(screen.getByText('Downloading Update')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <UpdateDialog
        open={false}
        version="1.5.1"
        progress={50}
        status="downloading"
      />
    );

    expect(screen.queryByText('Downloading Update')).not.toBeInTheDocument();
  });

  it('should display version when provided', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        progress={50}
        status="downloading"
      />
    );

    expect(screen.getByText(/Updating to version 1.5.1/)).toBeInTheDocument();
  });

  it('should display downloading status', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        progress={50}
        status="downloading"
      />
    );

    expect(screen.getByText('Downloading Update')).toBeInTheDocument();
    expect(screen.getByText(/Please wait while the update is downloaded/)).toBeInTheDocument();
  });

  it('should display installing status', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        status="installing"
      />
    );

    expect(screen.getByText('Installing Update')).toBeInTheDocument();
    expect(screen.getByText(/The update is being installed/)).toBeInTheDocument();
  });

  it('should display progress when downloading', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        progress={75.5}
        status="downloading"
      />
    );

    expect(screen.getByText('75.5%')).toBeInTheDocument();
  });

  it('should not display progress when installing', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        progress={50}
        status="installing"
      />
    );

    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('should show circular progress when installing', () => {
    render(
      <UpdateDialog
        open={true}
        version="1.5.1"
        status="installing"
      />
    );

    // CircularProgress should be present
    const progressElements = screen.getAllByRole('progressbar');
    expect(progressElements.length).toBeGreaterThan(0);
  });
});


