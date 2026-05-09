import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {useCallback, useEffect, useState} from 'react';
import {getRecentConsoleEvents, getRecentNetworkEvents, syncToBackend} from './doctor-sdk';

type NetworkEvent = {
  id: string;
  tsHuman: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  reqBody: unknown;
  locationId: string;
};

type ConsoleEvent = {
  id: string;
  tsHuman: string;
  level: 'error' | 'warn' | 'rejection';
  message: string;
  stack?: string;
};

type Finding = {id: string; ts: string; pattern: string; severity: string; url?: string};

function statusColor(status: number): string {
  if (status >= 500) {
    return '#ff6b6b';
  }
  if (status >= 400) {
    return '#ffa94d';
  }
  if (status >= 200 && status < 300) {
    return '#69db7c';
  }
  return '#aaa';
}

function levelColor(level: string): string {
  if (level === 'error') {
    return '#ff6b6b';
  }
  if (level === 'rejection') {
    return '#ffa94d';
  }
  return '#ffe066';
}

export function DoctorPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [network, setNetwork] = useState<NetworkEvent[]>([]);
  const [console_, setConsole] = useState<ConsoleEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [net, con] = await Promise.all([getRecentNetworkEvents(30), getRecentConsoleEvents(30)]);
    setNetwork(net as NetworkEvent[]);
    setConsole(con as ConsoleEvent[]);
  }, []);

  // Load on open, then refresh every 3s while open
  useEffect(() => {
    if (!open) {
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [open, refresh]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncToBackend(true);
      const newFindings = (result.findings ?? []) as Finding[];
      setFindings((prev) => [...newFindings, ...prev].slice(0, 20));
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  const alertCount = findings.filter((f) => f.severity === 'high').length;

  return (
    <>
      {/* Floating button */}
      <Box sx={{position: 'fixed', bottom: 24, right: 24, zIndex: 9999}}>
        <Badge badgeContent={alertCount} color="error">
          <Fab
            size="medium"
            onClick={() => setOpen((v) => !v)}
            sx={{bgcolor: '#1a1a2e', color: '#fff', '&:hover': {bgcolor: '#16213e'}}}
          >
            <Typography fontSize={18}>🩺</Typography>
          </Fab>
        </Badge>
      </Box>

      {/* Panel */}
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            width: 480,
            maxHeight: '72vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9998,
            bgcolor: '#0f0f23',
            color: '#e0e0e0',
            borderRadius: 2,
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <Typography fontWeight={700} fontSize={13} color="#7eb8f7" sx={{letterSpacing: 1}}>
              IDS DOCTOR
            </Typography>
            <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
              <Tooltip title="Sync telemetry to .doctor/ files for Claude Code to read">
                <Button
                  size="small"
                  disabled={syncing}
                  onClick={() => void handleSync()}
                  sx={{
                    color: '#7eb8f7',
                    fontSize: 11,
                    minWidth: 0,
                    p: '2px 8px',
                    textTransform: 'none',
                  }}
                >
                  {syncing ? 'Syncing…' : 'Sync'}
                </Button>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)} sx={{color: '#666', p: 0.5}}>
                ✕
              </IconButton>
            </Box>
          </Box>

          {/* Alerts bar */}
          {findings.length > 0 && (
            <Box sx={{px: 2, py: 0.75, bgcolor: '#1a0a0a', flexShrink: 0}}>
              {findings.slice(0, 3).map((f) => (
                <Typography
                  key={f.id}
                  fontSize={11}
                  color={f.severity === 'high' ? '#ff6b6b' : '#ffa94d'}
                >
                  {f.severity === 'high' ? '🔴' : '🟡'} {f.pattern}
                  {f.url ? ` — ${f.url}` : ''} · {f.ts}
                </Typography>
              ))}
              {findings.length > 3 && (
                <Typography fontSize={10} color="#666">
                  +{findings.length - 3} more
                </Typography>
              )}
            </Box>
          )}

          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v: number) => setTab(v)}
            sx={{
              flexShrink: 0,
              bgcolor: '#12122a',
              minHeight: 32,
              '& .MuiTab-root': {
                color: '#666',
                fontSize: 11,
                minHeight: 32,
                py: 0,
                textTransform: 'none',
              },
              '& .Mui-selected': {color: '#7eb8f7'},
              '& .MuiTabs-indicator': {bgcolor: '#7eb8f7'},
            }}
          >
            <Tab label={`Console (${console_.length})`} />
            <Tab label={`Network (${network.length})`} />
          </Tabs>

          {/* Tab content */}
          <Box sx={{flex: 1, overflowY: 'auto'}}>
            {/* Console tab */}
            {tab === 0 && (
              <Box>
                {console_.length === 0 && (
                  <Typography fontSize={12} color="#444" sx={{p: 2, textAlign: 'center'}}>
                    No console errors captured yet
                  </Typography>
                )}
                {console_.map((e) => (
                  <Box key={e.id} sx={{px: 2, py: 0.75, borderBottom: '1px solid #1a1a3a'}}>
                    <Box sx={{display: 'flex', gap: 1, alignItems: 'baseline'}}>
                      <Typography fontSize={10} color={levelColor(e.level)} sx={{flexShrink: 0}}>
                        {e.level.toUpperCase()}
                      </Typography>
                      <Typography fontSize={10} color="#555" sx={{flexShrink: 0}}>
                        {e.tsHuman}
                      </Typography>
                    </Box>
                    <Typography
                      fontSize={11}
                      sx={{color: '#ccc', wordBreak: 'break-all', mt: 0.25}}
                    >
                      {e.message}
                    </Typography>
                    {e.stack && (
                      <Typography
                        fontSize={10}
                        color="#555"
                        sx={{whiteSpace: 'pre-wrap', mt: 0.25}}
                      >
                        {e.stack.slice(0, 200)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Network tab */}
            {tab === 1 && (
              <Box>
                {network.length === 0 && (
                  <Typography fontSize={12} color="#444" sx={{p: 2, textAlign: 'center'}}>
                    No API calls captured yet
                  </Typography>
                )}
                {network.map((e) => (
                  <Box key={e.id} sx={{px: 2, py: 0.75, borderBottom: '1px solid #1a1a3a'}}>
                    <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                      <Typography fontSize={10} color="#7eb8f7" sx={{flexShrink: 0, minWidth: 36}}>
                        {e.method}
                      </Typography>
                      <Typography
                        fontSize={10}
                        color={statusColor(e.status)}
                        sx={{flexShrink: 0, minWidth: 28}}
                      >
                        {e.status}
                      </Typography>
                      <Typography
                        fontSize={10}
                        color="#ccc"
                        sx={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.url}
                      </Typography>
                      <Typography fontSize={10} color="#555" sx={{flexShrink: 0}}>
                        {e.durationMs}ms
                      </Typography>
                    </Box>
                    <Box sx={{display: 'flex', gap: 1, mt: 0.25}}>
                      <Typography fontSize={10} color="#555">
                        {e.tsHuman}
                      </Typography>
                      {e.locationId && (
                        <Typography fontSize={10} color={e.locationId === '' ? '#ff6b6b' : '#555'}>
                          loc: {e.locationId === '' ? '⚠ EMPTY' : e.locationId}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </>
  );
}
