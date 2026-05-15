import {valibotResolver} from '@hookform/resolvers/valibot';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {useEffect} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {type SubmitFunction, useSubmit} from 'react-router';
import {
  type VendorFormValues,
  vendorCreateSchema,
  vendorUpdateSchema,
} from './schemas/vendorSchema';
import type {DbVendor} from './types/vendor';

type Props = {
  mode: 'create' | 'edit';
  initialData?: DbVendor | null;
  isSubmitting: boolean;
  serverError?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
};

export function VendorForm({mode, initialData, isSubmitting, serverError, onDirtyChange}: Props) {
  const submit: SubmitFunction = useSubmit();
  const isEdit = mode === 'edit';

  const {
    control,
    handleSubmit,
    formState: {isDirty, errors},
  } = useForm<VendorFormValues>({
    resolver: valibotResolver(isEdit ? vendorUpdateSchema : vendorCreateSchema),
    defaultValues: {
      code: initialData?.code ?? '',
      name: initialData?.name ?? '',
      terms: initialData?.terms ?? '',
    },
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleFormSubmit = (data: VendorFormValues) => {
    const payload = isEdit
      ? {name: data.name, terms: data.terms || null}
      : {code: data.code, name: data.name, terms: data.terms || null};
    submit(
      {payload: JSON.stringify(payload)},
      {method: 'post', encType: 'application/x-www-form-urlencoded'},
    );
  };

  return (
    <>
      <button
        id="vendor-form-submit"
        type="button"
        onClick={handleSubmit(handleFormSubmit)}
        disabled={isSubmitting}
        style={{display: 'none'}}
      />

      {serverError && (
        <Alert severity="error" sx={{mb: 3}} data-testid="vendor-form-error">
          {serverError}
        </Alert>
      )}

      <Box sx={{mt: 2}}>
        <Typography variant="subtitle2" sx={{mb: 2, fontWeight: 600}}>
          Vendor Details
        </Typography>
        <Stack spacing={2.5}>
          <Controller
            name="code"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Vendor Code"
                size="small"
                required={!isEdit}
                disabled={isEdit}
                error={!!errors.code}
                helperText={errors.code?.message}
                slotProps={{htmlInput: {'data-testid': 'vendor-code-input'}}}
                fullWidth
              />
            )}
          />
          <Controller
            name="name"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Vendor Name"
                size="small"
                required
                error={!!errors.name}
                helperText={errors.name?.message}
                slotProps={{htmlInput: {'data-testid': 'vendor-name-input'}}}
                fullWidth
              />
            )}
          />
          <Controller
            name="terms"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Payment Terms"
                size="small"
                placeholder="e.g. Net 30"
                slotProps={{htmlInput: {'data-testid': 'vendor-terms-input'}}}
                fullWidth
              />
            )}
          />
        </Stack>
      </Box>
    </>
  );
}
