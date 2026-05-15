import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type {Control, FieldErrors} from 'react-hook-form';
import {Controller} from 'react-hook-form';
import {useTranslation} from 'react-i18next';
import type {PartBinRow, PartFormValues} from '../../schemas/partSchema';
import type {PartStatusCodeOption} from '../../types/part';

// ── Types ────────────────────────────────────────────────────────────────────

type BinOption = {code: string; description: string | null};

type Props = {
  mode: 'create' | 'view' | 'edit';
  control: Control<PartFormValues>;
  errors: FieldErrors<PartFormValues>;
  partIdConflict?: boolean;
  statusOptions: PartStatusCodeOption[];
  binOptions: BinOption[];
  onBinSearch: (term: string) => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ViewField({label, value}: {label: string; value?: string | null}) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{color: 'text.secondary', fontWeight: 500, display: 'block', mb: 0.25}}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{color: value ? 'text.primary' : 'text.disabled'}}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function PartIdentitySection({
  mode,
  control,
  errors,
  partIdConflict,
  statusOptions,
  binOptions,
  onBinSearch,
}: Props) {
  const {t} = useTranslation('parts');
  const isView = mode === 'view';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'},
        gap: 2,
      }}
    >
      {/* Part Number */}
      <Controller
        name="partNumber"
        control={control}
        render={({field}) =>
          isView ? (
            <ViewField label={t('create.fields.partId')} value={field.value} />
          ) : (
            <TextField
              {...field}
              label={t('create.fields.partId')}
              size="small"
              fullWidth
              disabled={mode === 'edit'}
              error={!!partIdConflict || !!errors.partNumber}
              helperText={
                partIdConflict ? 'A part with this ID already exists' : errors.partNumber?.message
              }
            />
          )
        }
      />

      {/* Description */}
      <Controller
        name="description"
        control={control}
        render={({field}) =>
          isView ? (
            <ViewField label={t('create.fields.description')} value={field.value} />
          ) : (
            <TextField
              {...field}
              label={t('create.fields.description')}
              size="small"
              fullWidth
              error={!!errors.description}
              helperText={errors.description?.message}
            />
          )
        }
      />

      {/* Status */}
      <Controller
        name="status"
        control={control}
        render={({field}) =>
          isView ? (
            <ViewField
              label={t('create.fields.status')}
              value={statusOptions.find((o) => o.code === field.value)?.description ?? field.value}
            />
          ) : (
            <TextField
              {...field}
              select
              label={t('create.fields.status')}
              size="small"
              fullWidth
              error={!!errors.status}
              helperText={errors.status?.message}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.code} value={opt.code}>
                  {opt.description}
                </MenuItem>
              ))}
            </TextField>
          )
        }
      />

      {/* Comments — full width */}
      <Controller
        name="comments"
        control={control}
        render={({field}) =>
          isView ? (
            <Box sx={{gridColumn: {sm: '1 / -1'}}}>
              <ViewField label={t('create.fields.comments')} value={field.value} />
            </Box>
          ) : (
            <TextField
              {...field}
              label={t('create.fields.comments')}
              size="small"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.comments}
              helperText={errors.comments?.message}
              sx={{gridColumn: {sm: '1 / -1'}}}
            />
          )
        }
      />

      {/* Bins Autocomplete — hidden in view, full width */}
      {!isView && (
        <Controller
          name="bins"
          control={control}
          render={({field}) => {
            const displayValue: BinOption[] = field.value.map((b: PartBinRow) => ({
              code: b.binCode,
              description: b.description,
            }));

            function handleChange(_event: React.SyntheticEvent, newValue: BinOption[]) {
              const mapped: PartBinRow[] = newValue.map((opt, idx) => ({
                binCode: opt.code,
                description: opt.description,
                isMain: idx === 0,
              }));
              field.onChange(mapped);
            }

            return (
              <Autocomplete
                multiple
                options={binOptions}
                value={displayValue}
                getOptionLabel={(opt) =>
                  opt.description ? `${opt.code} — ${opt.description}` : opt.code
                }
                isOptionEqualToValue={(opt, val) => opt.code === val.code}
                onInputChange={(_event, value) => onBinSearch(value)}
                onChange={handleChange}
                sx={{gridColumn: {sm: '1 / -1'}}}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('create.fields.bins')}
                    size="small"
                    error={!!errors.bins}
                    helperText={errors.bins?.message}
                  />
                )}
              />
            );
          }}
        />
      )}

      {/* Prompt for serial number — hidden in view */}
      {!isView && (
        <Controller
          name="promptForSerialNumber"
          control={control}
          render={({field}) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label={t('create.fields.promptForSerialNumber')}
            />
          )}
        />
      )}

      {/* Bypass price update — hidden in view */}
      {!isView && (
        <Controller
          name="bypassPriceUpdate"
          control={control}
          render={({field}) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label={t('create.fields.bypassPriceUpdate')}
            />
          )}
        />
      )}
    </Box>
  );
}
