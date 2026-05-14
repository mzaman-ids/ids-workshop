import PersonIcon from '@mui/icons-material/Person';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import {type GridColDef, type GridRenderCellParams} from '@mui/x-data-grid';
import type {TFunction} from 'i18next';
import {API_CONFIG} from '../../core/config/api';
import type {UserProfile} from './types/user';

export function getUserListColumns(t: TFunction<'users'>): GridColDef[] {
  return [
    {
      field: 'displayName',
      headerName: t('userList.displayName'),
      flex: 1.5,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams<UserProfile>) => {
        const user = params.row as UserProfile;
        const photoUrl = user.hasProfilePhoto
          ? `${API_CONFIG.baseUrl}/user/${user.logtoUserId}/photo`
          : undefined;
        return (
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Avatar src={photoUrl} sx={{width: 28, height: 28, fontSize: '0.75rem'}}>
              {!photoUrl && <PersonIcon sx={{fontSize: 16}} />}
            </Avatar>
            <Typography sx={{fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary'}}>
              {user.displayName ?? user.email}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'email',
      headerName: t('userList.email'),
      flex: 1.5,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams<UserProfile>) => (
        <Typography sx={{fontSize: '0.8125rem', color: 'text.primary'}}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'username',
      headerName: t('userList.username'),
      flex: 1,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<UserProfile>) => (
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
            color: params.value ? 'text.primary' : 'text.secondary',
          }}
        >
          {(params.value as string | null) ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'lastLoginAt',
      headerName: t('userList.lastLogin'),
      flex: 1,
      minWidth: 130,
      renderCell: (params: GridRenderCellParams<UserProfile>) => {
        const val = params.value as string | null;
        return (
          <Typography
            sx={{fontSize: '0.8125rem', color: val ? 'text.primary' : 'text.secondary'}}
          >
            {val ? new Date(val).toLocaleDateString() : t('never')}
          </Typography>
        );
      },
    },
    {
      field: 'profileCompleteness',
      headerName: t('userList.profileCompleteness'),
      flex: 0.8,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<UserProfile>) => {
        const pct = params.value as number;
        return (
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, width: '100%'}}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{flex: 1, height: 6, borderRadius: 3}}
            />
            <Typography sx={{fontSize: '0.75rem', color: 'text.secondary', minWidth: 30}}>
              {pct}%
            </Typography>
          </Box>
        );
      },
    },
  ];
}
