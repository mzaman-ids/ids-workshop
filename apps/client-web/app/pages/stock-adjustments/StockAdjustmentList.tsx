import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {DataGrid} from '@mui/x-data-grid';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {useLocation} from 'core/contexts/location/useLocation';
import {RESOLVED_LOCATION_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useMemo, useState} from 'react';
import {type ClientLoaderFunctionArgs, useNavigate} from 'react-router';
import {getStockAdjustmentColumns} from './columns';
import {useStockAdjustments} from './hooks/useStockAdjustments';
import {stockAdjustmentQueries} from './queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from './queries/stockAdjustmentQueryKey';
import type {AdjustmentType} from './types/stockAdjustment';

const DEFAULT_PAGE_SIZE = 25;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 52;
const GRID_HEIGHT = ROW_HEIGHT * DEFAULT_PAGE_SIZE + HEADER_HEIGHT + FOOTER_HEIGHT;

export async function clientLoader({context}: ClientLoaderFunctionArgs) {
  const resolved = context.get(RESOLVED_LOCATION_CONTEXT);
  if (!resolved) {
    return null;
  }
  const {locationId, locationToken} = resolved;

  await queryClient.ensureQueryData({
    queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.list(locationId, {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    queryFn: ({signal}) =>
      stockAdjustmentQueries.fetchAll({
        locationId,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        signal,
        token: locationToken,
      }),
  });

  return null;
}

export default function StockAdjustmentList() {
  const navigate = useNavigate();
  const {currentLocation} = useLocation();
  const locationId = currentLocation?.id ?? '';

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AdjustmentType>('all');

  const {data, isLoading, error} = useStockAdjustments({
    locationId,
    page: page + 1,
    pageSize,
    searchTerm: search || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
  });

  const columns = useMemo(() => getStockAdjustmentColumns(), []);

  return (
    <Box sx={{width: '100%', p: 2}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap'}}>
        <TextField
          size="small"
          placeholder="Search by part number or description…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{minWidth: 280}}
        />
        <ToggleButtonGroup
          size="small"
          value={typeFilter}
          exclusive
          onChange={(_, v) => {
            if (v !== null) {
              setTypeFilter(v);
              setPage(0);
            }
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="add">Add</ToggleButton>
          <ToggleButton value="remove">Remove</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{flexGrow: 1}} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/stock-adjustments/create')}
          sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
        >
          New Adjustment
        </Button>
      </Box>

      {error && (
        <Box sx={{mb: 2}}>
          <QueryErrorAlert error={error} />
        </Box>
      )}

      <DataGrid
        rows={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        rowCount={data?.total ?? 0}
        paginationMode="server"
        paginationModel={{page, pageSize}}
        onPaginationModelChange={(m) => {
          setPage(m.page);
          setPageSize(m.pageSize);
        }}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        rowHeight={ROW_HEIGHT}
        columnHeaderHeight={HEADER_HEIGHT}
        sx={{height: GRID_HEIGHT, border: 'none'}}
      />
    </Box>
  );
}
