import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {BUILD_INFO} from 'core/config/buildInfo';

function VersionTooltip() {
  const isDev = BUILD_INFO.env === 'development';
  return (
    <Box sx={{minWidth: 160}}>
      <Typography variant="caption" sx={{fontWeight: 700, display: 'block', mb: 0.75}}>
        IDS Astra
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25}}>
        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Version
        </Typography>
        <Typography variant="caption">{BUILD_INFO.version}</Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Build
        </Typography>
        <Typography variant="caption" sx={{fontFamily: 'monospace'}}>
          {BUILD_INFO.gitSha}
        </Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Date
        </Typography>
        <Typography variant="caption">{BUILD_INFO.buildDate}</Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Env
        </Typography>
        <Box
          component="span"
          sx={
            isDev
              ? {
                  bgcolor: 'rgba(25, 118, 210, 0.2)',
                  border: '1px solid rgba(25, 118, 210, 0.5)',
                  borderRadius: 0.5,
                  px: 0.5,
                  color: '#90caf9',
                  fontSize: '0.7rem',
                }
              : {fontSize: '0.7rem'}
          }
        >
          {BUILD_INFO.env}
        </Box>
      </Box>
    </Box>
  );
}

export function AppVersionChip() {
  const label = `v${BUILD_INFO.version} · ${BUILD_INFO.gitSha} · ${BUILD_INFO.buildDate}`;
  return (
    <Tooltip title={<VersionTooltip />} placement="bottom-end">
      <Box
        aria-label={`App version: ${label}`}
        sx={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          px: 1.25,
          py: 0.375,
          mx: 1,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.75)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
