import Typography from '@mui/material/Typography';
import {type GridColDef, type GridRenderCellParams} from '@mui/x-data-grid';
import type {DbVendor} from './types/vendor';

export function getVendorListColumns(): GridColDef[] {
  return [
    {
      field: 'code',
      headerName: 'Code',
      flex: 0.8,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography sx={{fontSize: '0.8125rem', fontFamily: 'monospace', color: 'text.primary'}}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography sx={{fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary'}}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'terms',
      headerName: 'Terms',
      flex: 1,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography
          sx={{fontSize: '0.8125rem', color: params.value ? 'text.primary' : 'text.secondary'}}
        >
          {(params.value as string | null) ?? '—'}
        </Typography>
      ),
    },
  ];
}
