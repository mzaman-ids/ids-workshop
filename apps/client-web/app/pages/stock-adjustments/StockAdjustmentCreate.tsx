import {valibotResolver} from '@hookform/resolvers/valibot';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {AUTH_KERNEL_CONTEXT, RESOLVED_LOCATION_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useEffect} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {
  type ClientActionFunctionArgs,
  type Navigation,
  useActionData,
  useNavigate,
  useNavigation,
  useSubmit,
} from 'react-router';
import {stockAdjustmentQueries} from './queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from './queries/stockAdjustmentQueryKey';
import {
  type StockAdjustmentFormValues,
  stockAdjustmentSchema,
} from './schemas/stockAdjustmentSchema';
import type {AdjustmentReasonCode} from './types/stockAdjustment';

const REASON_OPTIONS: {value: AdjustmentReasonCode; label: string}[] = [
  {value: 'CYCLE_COUNT', label: 'Cycle Count'},
  {value: 'DAMAGE', label: 'Damage / Write-off'},
  {value: 'THEFT', label: 'Theft'},
  {value: 'FOUND', label: 'Found / Unaccounted'},
  {value: 'TRANSFER_IN', label: 'Transfer In'},
  {value: 'TRANSFER_OUT', label: 'Transfer Out'},
  {value: 'OTHER', label: 'Other (specify in notes)'},
];

export async function clientAction({request, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const resolvedLocation = context.get(RESOLVED_LOCATION_CONTEXT);
  const token = await authKernel.getValidToken();

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const values = JSON.parse(raw) as StockAdjustmentFormValues;
    const result = await stockAdjustmentQueries.create(
      {
        locationId: resolvedLocation?.locationId ?? '',
        partNumber: values.partNumber,
        type: values.type,
        quantity: values.quantity,
        reasonCode: values.reasonCode,
        notes: values.notes ?? null,
      },
      token ?? '',
    );
    await queryClient.invalidateQueries({
      queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.all(resolvedLocation?.locationId ?? ''),
    });
    return {success: true as const, adjustmentNumber: result.adjustmentNumber};
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to create adjustment',
    };
  }
}

export default function StockAdjustmentCreate() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const {
    control,
    handleSubmit,
    watch,
    formState: {errors},
  } = useForm<StockAdjustmentFormValues>({
    resolver: valibotResolver(stockAdjustmentSchema),
    defaultValues: {type: 'add', quantity: 1, reasonCode: undefined, notes: null},
  });

  const reasonCode = watch('reasonCode');
  const isOther = reasonCode === 'OTHER';

  // Root-level schema error (cross-field validation for OTHER + notes)
  const rootError = (errors as {root?: {message?: string}}).root?.message;

  const onSubmit = (values: StockAdjustmentFormValues) => {
    const formData = new FormData();
    formData.set('payload', JSON.stringify(values));
    submit(formData, {method: 'post'});
  };

  useEffect(() => {
    if (!actionData?.success) {
      return;
    }
    const timer = setTimeout(() => navigate('/stock-adjustments'), 1500);
    return () => clearTimeout(timer);
  }, [actionData, navigate]);

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[{label: 'Stock Adjustments', to: '/stock-adjustments'}, {label: 'New Adjustment'}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Save Adjustment'}
          </Button>
        }
      />

      {actionData?.success && (
        <HideAfterDelay delay={1500}>
          <Alert
            icon={<CheckCircleOutlineIcon fontSize="inherit" />}
            severity="success"
            sx={{mb: 2}}
          >
            Adjustment {actionData.adjustmentNumber} created — inventory updated.
          </Alert>
        </HideAfterDelay>
      )}
      {actionData && !actionData.success && (
        <Alert severity="error" sx={{mb: 2}}>
          {actionData.error}
        </Alert>
      )}

      <Box sx={{maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 3, mt: 2}}>
        <Card variant="outlined">
          <CardContent sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            <Typography variant="subtitle2" color="text.secondary">
              Part
            </Typography>
            <Controller
              name="partNumber"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  label="Part Number"
                  required
                  size="small"
                  error={!!errors.partNumber}
                  helperText={errors.partNumber?.message}
                  inputProps={{'data-testid': 'part-number-input'}}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            <Typography variant="subtitle2" color="text.secondary">
              Adjustment
            </Typography>

            <Controller
              name="type"
              control={control}
              render={({field}) => (
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{mb: 0.5, display: 'block'}}
                  >
                    Type *
                  </Typography>
                  <ToggleButtonGroup
                    value={field.value}
                    exclusive
                    onChange={(_, v) => {
                      if (v !== null) {
                        field.onChange(v);
                      }
                    }}
                    size="small"
                  >
                    <ToggleButton value="add" color="success">
                      Add
                    </ToggleButton>
                    <ToggleButton value="remove" color="error">
                      Remove
                    </ToggleButton>
                  </ToggleButtonGroup>
                  {errors.type && <FormHelperText error>{errors.type.message}</FormHelperText>}
                </Box>
              )}
            />

            <Controller
              name="quantity"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  label="Quantity"
                  type="number"
                  required
                  size="small"
                  inputProps={{min: 1, step: 1}}
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                  sx={{maxWidth: 160}}
                />
              )}
            />

            <Divider />

            <Controller
              name="reasonCode"
              control={control}
              render={({field}) => (
                <FormControl size="small" error={!!errors.reasonCode} required>
                  <InputLabel>Reason</InputLabel>
                  <Select {...field} label="Reason" value={field.value ?? ''}>
                    {REASON_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.reasonCode && (
                    <FormHelperText>{errors.reasonCode.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />

            <Controller
              name="notes"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label={isOther ? 'Notes (required)' : 'Notes'}
                  multiline
                  rows={3}
                  size="small"
                  required={isOther}
                  error={!!errors.notes || (isOther && !!rootError)}
                  helperText={errors.notes?.message ?? (isOther ? rootError : undefined)}
                />
              )}
            />
          </CardContent>
        </Card>

        <Box sx={{display: 'flex', gap: 1}}>
          <Button
            variant="outlined"
            onClick={() => navigate('/stock-adjustments')}
            sx={{textTransform: 'none'}}
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
