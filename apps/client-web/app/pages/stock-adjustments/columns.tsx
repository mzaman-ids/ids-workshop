import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type {GridColDef} from '@mui/x-data-grid';
import type {DbStockAdjustmentListItem} from './types/stockAdjustment';

const REASON_LABELS: Record<string, string> = {
  CYCLE_COUNT: 'Cycle Count',
  DAMAGE: 'Damage / Write-off',
  THEFT: 'Theft',
  FOUND: 'Found / Unaccounted',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  OTHER: 'Other',
};

export function getStockAdjustmentColumns(): GridColDef<DbStockAdjustmentListItem>[] {
  return [
    {field: 'adjustmentNumber', headerName: 'Adj #', width: 140, sortable: true},
    {field: 'partNumber', headerName: 'Part #', width: 140, sortable: true},
    {field: 'partDescriptionSnapshot', headerName: 'Description', flex: 1, minWidth: 200},
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: ({row}) => (
        <Chip
          label={row.type === 'add' ? 'Add' : 'Remove'}
          color={row.type === 'add' ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'quantityDelta',
      headerName: 'Qty',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({row}) => (
        <Typography
          variant="body2"
          sx={{color: row.quantityDelta > 0 ? 'success.main' : 'error.main', fontWeight: 600}}
        >
          {row.quantityDelta > 0 ? `+${row.quantityDelta}` : String(row.quantityDelta)}
        </Typography>
      ),
    },
    {
      field: 'reasonCode',
      headerName: 'Reason',
      width: 160,
      valueFormatter: (value: string) => REASON_LABELS[value] ?? value,
    },
    {
      field: 'createdDate',
      headerName: 'Date',
      width: 170,
      valueFormatter: (value: string) => (value ? new Date(value).toLocaleString() : ''),
    },
    {field: 'createdBy', headerName: 'Adjusted By', width: 150},
  ];
}
