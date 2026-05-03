
import { render, screen, waitFor } from '@testing-library/react';
import { HostProvider, useHosts } from './HostContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// A simple component to consume the context for testing
const TestComponent = () => {
  const { hosts } = useHosts();
  return (
    <div>
      {hosts.length === 0 ? (
        <span>No hosts loaded</span>
      ) : (
        hosts.map(h => <span key={h.id} data-testid="host-item">{h.name} - {h.address}</span>)
      )}
    </div>
  );
};

describe('HostContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display hosts on mount', async () => {
    render(
      <HostProvider>
        <TestComponent />
      </HostProvider>
    );

    // Initial state might be empty briefly, but since list_hosts is mocked, it will update
    await waitFor(() => {
      expect(screen.getByTestId('host-item')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Server - 192.168.1.100')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('list_hosts');
  });

  it('should throw an error if useHosts is used outside of HostProvider', () => {
    // Suppress console.error for the expected error
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => render(<TestComponent />)).toThrow('useHosts must be used within a HostProvider');

    console.error = originalError;
  });
});
