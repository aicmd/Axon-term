import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd, _args) => {
    if (cmd === 'list_hosts') {
      return Promise.resolve([
        {
          id: 'test-host-1',
          name: 'Test Server',
          address: '192.168.1.100',
          port: 22,
          username: 'admin',
          authType: 'password',
          state: 'Disconnected'
        }
      ]);
    }
    return Promise.resolve();
  })
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn()))
}));
