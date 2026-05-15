import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AppVersionChip} from '../../app/components/AppVersionChip';

vi.mock('core/config/buildInfo', () => ({
  BUILD_INFO: {
    version: '1.2.3',
    gitSha: 'abc1234',
    buildDate: '2026-05-15',
    env: 'test',
  },
}));

describe('AppVersionChip', () => {
  it('renders version, git SHA and build date in the chip label', () => {
    render(<AppVersionChip />);
    expect(screen.getByText('v1.2.3 · abc1234 · 2026-05-15')).toBeInTheDocument();
  });

  it('has an accessible aria-label containing the version string', () => {
    render(<AppVersionChip />);
    expect(screen.getByLabelText('App version: v1.2.3 · abc1234 · 2026-05-15')).toBeInTheDocument();
  });
});
