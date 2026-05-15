import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useState} from 'react';
import {
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  type Navigation,
  useActionData,
  useNavigation,
  useParams,
} from 'react-router';
import {useVendor} from './hooks/useVendor';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';
import {VendorForm} from './VendorForm';

export async function clientLoader({params, context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const id = params.id ?? '';

  await queryClient.ensureQueryData({
    queryKey: VENDOR_QUERY_KEYS.detail(id),
    queryFn: ({signal}) => vendorQueries.fetchById({id, signal, token: token ?? ''}),
  });

  return {id};
}

export async function clientAction({request, params, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const id = params.id ?? '';

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const payload = JSON.parse(raw);
    await vendorQueries.update(id, payload, token ?? '');
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.all()});
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.detail(id)});
    return {success: true as const};
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update vendor',
    };
  }
}

export default function VendorDetail() {
  const {id} = useParams<{id: string}>();
  const {data: vendor, isLoading, error} = useVendor(id ?? '');
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [formDirty, setFormDirty] = useState(false);
  const handleDirtyChange = useCallback((dirty: boolean) => setFormDirty(dirty), []);

  if (isLoading) {
    return (
      <Box sx={{display: 'flex', justifyContent: 'center', mt: 4}}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{width: '100%'}}>
      <QueryErrorAlert error={error instanceof Error ? error : null} />
      <Breadcrumb
        items={[{label: 'Vendors', to: '/vendors'}, {label: vendor?.name ?? id ?? ''}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting || !formDirty}
            onClick={() => document.getElementById('vendor-form-submit')?.click()}
            data-testid="vendor-save-button"
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      {actionData?.success && (
        <HideAfterDelay delay={3000}>
          <Alert
            icon={<CheckCircleOutlineIcon fontSize="inherit" />}
            severity="success"
            sx={{mb: 2}}
          >
            Vendor updated successfully.
          </Alert>
        </HideAfterDelay>
      )}

      <Box sx={{maxWidth: 600}}>
        <VendorForm
          mode="edit"
          initialData={vendor}
          isSubmitting={isSubmitting}
          serverError={actionData && !actionData.success ? actionData.error : null}
          onDirtyChange={handleDirtyChange}
        />
      </Box>
    </Box>
  );
}
