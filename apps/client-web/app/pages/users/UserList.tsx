import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {DataGrid} from '@mui/x-data-grid';
import {useQuery} from '@tanstack/react-query';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {useAuth} from 'core/contexts/auth/useAuth';
import {API_CONFIG} from 'core/config/api';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type ClientLoaderFunctionArgs, useNavigate} from 'react-router';
import {getUserListColumns} from './columns';
import {userQueries} from './queries/userQueries';
import {USER_QUERY_KEYS} from './queries/userQueryKey';

// ── clientLoader ──────────────────────────────────────────────────────────────

export async function clientLoader({context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  await queryClient.ensureQueryData({
    queryKey: USER_QUERY_KEYS.list({page: 1, pageSize: 10, isDeleted: false}),
    queryFn: ({signal}) =>
      userQueries.fetchAll({page: 1, pageSize: 10, isDeleted: false, signal, token: token ?? ''}),
  });

  return null;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 52;
const DEFAULT_PAGE_SIZE = 10;
const ROW_BORDER_PX = 0.1;
const GRID_HEIGHT =
  ROW_HEIGHT * DEFAULT_PAGE_SIZE +
  ROW_BORDER_PX * DEFAULT_PAGE_SIZE +
  HEADER_HEIGHT +
  FOOTER_HEIGHT;

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserList() {
  const navigate = useNavigate();
  const {accessToken} = useAuth();
  const {t} = useTranslation('users');

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const measureRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    if (width > 0) setGridWidth(Math.floor(width));
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setGridWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isDeletedParam: boolean | undefined =
    statusFilter === 'all' ? undefined : statusFilter === 'inactive';

  const {data, isFetching, error} = useQuery({
    queryKey: USER_QUERY_KEYS.list({page, pageSize, searchTerm: search, isDeleted: isDeletedParam}),
    queryFn: ({signal}) =>
      userQueries.fetchAll({
        page: page + 1,
        pageSize,
        searchTerm: search || undefined,
        isDeleted: isDeletedParam,
        signal,
        token: accessToken ?? '',
      }),
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const users = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  const handleSyncFromLogto = async () => {
    const token = accessToken ?? '';
    await fetch(`${API_CONFIG.baseUrl}/user/sync/from-logto`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    await queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.all()});
  };

  const columns = useMemo(() => getUserListColumns(t), [t]);

  return (
    <Box sx={{width: '100%'}}>
      <QueryErrorAlert error={error instanceof Error ? error : null} />
      <Typography
        variant="h5"
        component="h1"
        sx={{mb: 2, fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.3px'}}
      >
        {t('title')}
      </Typography>

      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {/* ── Toolbar ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            size="small"
            placeholder={t('search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search users"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{fontSize: 16, color: 'text.secondary'}} />
                  </InputAdornment>
                ),
                sx: {
                  fontSize: '0.8rem',
                  height: 36,
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': {borderColor: 'divider'},
                },
              },
            }}
            sx={{flex: 1}}
          />
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, value: 'active' | 'inactive' | 'all') => {
              if (value !== null) {
                setStatusFilter(value);
                setPage(0);
              }
            }}
            size="small"
            aria-label="Filter by status"
            sx={{
              '& .MuiToggleButton-root': {
                height: 36,
                px: 1.5,
                fontSize: '0.8125rem',
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="active">{t('filter.active')}</ToggleButton>
            <ToggleButton value="inactive">{t('filter.inactive')}</ToggleButton>
            <ToggleButton value="all">{t('filter.all')}</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SyncIcon />}
            onClick={handleSyncFromLogto}
            sx={{
              height: 36,
              px: 2,
              borderRadius: '8px',
              fontSize: '0.8125rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              textTransform: 'none',
            }}
          >
            {t('syncFromLogto')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/users/create')}
            sx={{
              height: 36,
              px: 2,
              borderRadius: '8px',
              fontSize: '0.8125rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {boxShadow: 'none'},
              '&:active': {boxShadow: 'none'},
            }}
          >
            {t('createUser')}
          </Button>
        </Box>

        {/* ── DataGrid ── */}
        <div ref={measureRef} style={{width: '100%'}}>
          {gridWidth > 0 && (
            <div style={{width: gridWidth, height: GRID_HEIGHT}}>
              <DataGrid
                columns={columns}
                columnHeaderHeight={44}
                disableRowSelectionOnClick
                getRowId={(row) => row.logtoUserId}
                onRowClick={(params) => navigate(`/users/${params.row.logtoUserId}`)}
                loading={isFetching && users.length === 0}
                onPaginationModelChange={(model) => {
                  if (model.pageSize !== pageSize) {
                    setPageSize(model.pageSize);
                    setPage(0);
                  } else {
                    setPage(model.page);
                  }
                }}
                paginationMode="server"
                paginationModel={{page, pageSize}}
                pageSizeOptions={[10, 25, 50, 100]}
                rows={users}
                rowHeight={ROW_HEIGHT}
                rowCount={Math.max(0, total)}
                slots={{
                  noRowsOverlay: () => (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <Typography sx={{fontSize: '0.8125rem', color: 'text.secondary'}}>
                        {t('noResults')}
                      </Typography>
                    </Box>
                  ),
                  loadingOverlay: () => (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <CircularProgress size={40} />
                    </Box>
                  ),
                }}
                sx={dataGridSx}
              />
            </div>
          )}
        </div>
      </Box>
    </Box>
  );
}

const dataGridSx = {
  border: 'none',
  '& .MuiDataGrid-columnHeaders': {
    bgcolor: 'background.default',
    borderColor: 'divider',
    minHeight: '44px !important',
    maxHeight: '44px !important',
    lineHeight: '44px',
  },
  '& .MuiDataGrid-columnHeader': {
    bgcolor: 'background.default',
    borderBottom: 'none !important',
    '&:focus, &:focus-within': {outline: 'none'},
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'text.secondary',
    textTransform: 'capitalize',
    letterSpacing: '0.04em',
  },
  '& .MuiDataGrid-row': {
    cursor: 'pointer',
    '&:hover': {bgcolor: 'action.hover'},
  },
  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid',
    borderColor: 'divider',
    '&:focus, &:focus-within': {outline: 'none'},
    display: 'flex',
    alignItems: 'center',
    py: 0,
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: 'divider',
    minHeight: 52,
  },
  '& .MuiDataGrid-virtualScroller': {bgcolor: 'background.paper'},
  '& .MuiDataGrid-scrollbar': {
    '&::-webkit-scrollbar': {width: 6, height: 6},
    '&::-webkit-scrollbar-thumb': {bgcolor: 'text.disabled', borderRadius: 3},
    '&::-webkit-scrollbar-track': {bgcolor: 'transparent'},
    scrollbarWidth: 'thin',
  },
  '& .MuiTablePagination-root': {fontSize: '0.8rem'},
  '& .MuiDataGrid-scrollbarFiller': {
    bgcolor: 'background.paper !important',
    borderTop: 'none !important',
  },
  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
    fontSize: '0.75rem',
    color: 'text.secondary',
    fontWeight: 400,
  },
  '& .MuiDataGrid-columnSeparator': {color: 'divider'},
} as const;
