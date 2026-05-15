import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {DataGrid} from '@mui/x-data-grid';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type ClientLoaderFunctionArgs, useNavigate} from 'react-router';
import {getVendorListColumns} from './columns';
import {useVendors} from './hooks/useVendors';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';

export async function clientLoader({context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  await queryClient.ensureQueryData({
    queryKey: VENDOR_QUERY_KEYS.list({page: 1, pageSize: 10}),
    queryFn: ({signal}) =>
      vendorQueries.fetchAll({page: 1, pageSize: 10, signal, token: token ?? ''}),
  });

  return null;
}

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

export default function VendorList() {
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');

  const measureRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) {
      return;
    }
    const width = el.getBoundingClientRect().width;
    if (width > 0) {
      setGridWidth(Math.floor(width));
    }
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next > 0) {
        setGridWidth(next);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => getVendorListColumns(), []);

  const {data, isFetching, error} = useVendors({
    page: page + 1,
    pageSize,
    searchTerm: search || undefined,
  });

  const vendors = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  return (
    <Box sx={{width: '100%'}}>
      <QueryErrorAlert error={error instanceof Error ? error : null} />
      <Typography
        variant="h5"
        component="h1"
        sx={{mb: 2, fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.3px'}}
      >
        Vendors
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
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
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
              htmlInput: {'data-testid': 'vendor-search-input'},
            }}
            sx={{flex: 1}}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/vendors/create')}
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
            }}
            data-testid="create-vendor-button"
          >
            New Vendor
          </Button>
        </Box>

        <div ref={measureRef} style={{width: '100%'}} data-testid="vendors-table-container">
          {gridWidth > 0 && (
            <div style={{width: gridWidth, height: GRID_HEIGHT}} data-testid="vendors-table">
              <DataGrid
                columns={columns}
                columnHeaderHeight={HEADER_HEIGHT}
                disableRowSelectionOnClick
                getRowId={(row) => row.id}
                onRowClick={(params) => navigate(`/vendors/${params.row.id}`)}
                loading={isFetching && vendors.length === 0}
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
                pageSizeOptions={[10, 25, 50]}
                rows={vendors}
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
                      <Typography
                        sx={{fontSize: '0.8125rem', color: 'text.secondary'}}
                        data-testid="vendors-no-results"
                      >
                        No vendors found
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
  '& .MuiTablePagination-root': {fontSize: '0.8rem'},
  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
    fontSize: '0.75rem',
    color: 'text.secondary',
    fontWeight: 400,
  },
} as const;
