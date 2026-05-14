import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useState} from 'react';
import {
  type ClientActionFunctionArgs,
  type Navigation,
  useActionData,
  useNavigate,
  useNavigation,
} from 'react-router';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';
import {VendorForm} from './VendorForm';

export async function clientAction({request, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const payload = JSON.parse(raw);
    await vendorQueries.create(payload, token ?? '');
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.all()});
    return {success: true as const};
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to create vendor',
    };
  }
}

export default function VendorCreate() {
  const navigate = useNavigate();
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [_formDirty, setFormDirty] = useState(false);
  const handleDirtyChange = useCallback((dirty: boolean) => setFormDirty(dirty), []);

  if (actionData?.success) {
    navigate('/vendors');
  }

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[{label: 'Vendors', to: '/vendors'}, {label: 'New Vendor'}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting}
            onClick={() => document.getElementById('vendor-form-submit')?.click()}
            data-testid="vendor-submit-button"
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Create Vendor'}
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
            Vendor created successfully.
          </Alert>
        </HideAfterDelay>
      )}

      <Box sx={{maxWidth: 600}}>
        <VendorForm
          mode="create"
          isSubmitting={isSubmitting}
          serverError={actionData && !actionData.success ? actionData.error : null}
          onDirtyChange={handleDirtyChange}
        />
      </Box>
    </Box>
  );
}
