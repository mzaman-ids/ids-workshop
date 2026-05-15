import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {BUILD_INFO} from 'core/config/buildInfo';

function VersionTooltip() {
  const isDev = BUILD_INFO.env === 'development';
  return (
    <Box sx={{minWidth: 180}}>
      <Typography
        variant="caption"
        sx={{fontWeight: 700, display: 'block', mb: 1, fontSize: '0.75rem', color: '#fff'}}
      >
        IDS Astra
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5}}>
        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.5)'}}>
          Version
        </Typography>
        <Typography variant="caption" sx={{color: '#fff'}}>
          {BUILD_INFO.version}
        </Typography>

        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.5)'}}>
          Build
        </Typography>
        <Typography variant="caption" sx={{fontFamily: 'monospace', color: '#fff'}}>
          {BUILD_INFO.gitSha}
        </Typography>

        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.5)'}}>
          Date
        </Typography>
        <Typography variant="caption" sx={{color: '#fff'}}>
          {BUILD_INFO.buildDate}
        </Typography>

        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.5)'}}>
          Env
        </Typography>
        <Box
          component="span"
          sx={
            isDev
              ? {
                  display: 'inline-block',
                  bgcolor: 'rgba(25, 118, 210, 0.3)',
                  border: '1px solid rgba(100, 181, 246, 0.6)',
                  borderRadius: 0.5,
                  px: 0.75,
                  color: '#90caf9',
                  fontSize: '0.7rem',
                  lineHeight: 1.6,
                }
              : {color: '#fff', fontSize: '0.7rem'}
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
    <Tooltip
      title={<VersionTooltip />}
      placement="bottom-end"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1.5,
            p: 1.5,
            maxWidth: 280,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          },
        },
      }}
    >
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
