import { describe, it, expect } from 'vitest';
import { getStatusColor } from '../statusUtils';
import { ConnectionState } from '../../types';

describe('getStatusColor', () => {
  it('should return yellow for disconnected host with an open tab', () => {
    const result = getStatusColor(ConnectionState.DISCONNECTED, true);
    expect(result).toContain('bg-yellow-500');
  });

  it('should return success color for connected state', () => {
    const result = getStatusColor(ConnectionState.CONNECTED, false);
    expect(result).toContain('bg-success');
  });

  it('should return accent with pulse for connecting state', () => {
    const result = getStatusColor(ConnectionState.CONNECTING, false);
    expect(result).toContain('bg-accent');
    expect(result).toContain('animate-pulse');
  });

  it('should return error color for error state', () => {
    const result = getStatusColor(ConnectionState.ERROR, false);
    expect(result).toContain('bg-error');
  });

  it('should return muted color for disconnected state without tab', () => {
    const result = getStatusColor(ConnectionState.DISCONNECTED, false);
    expect(result).toContain('bg-textMuted/30');
  });
});
