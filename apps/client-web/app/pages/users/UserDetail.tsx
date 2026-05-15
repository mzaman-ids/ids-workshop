import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {useMutation} from '@tanstack/react-query';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {UnsavedChangesDialog} from 'components/UnsavedChangesDialog';
import {API_CONFIG} from 'core/config/api';
import {useAuth} from 'core/contexts/auth/useAuth';
import {useLocationChangePrompt} from 'core/hooks/useLocationChangePrompt';
import {useUnsavedChangesGuard} from 'core/hooks/useUnsavedChangesGuard';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  type Navigation,
  useActionData,
  useNavigation,
  useParams,
} from 'react-router';
import {DeactivateDialog} from './components/DeactivateDialog';
import {useUser} from './hooks/useUser';
import {userQueries} from './queries/userQueries';
import {USER_QUERY_KEYS} from './queries/userQueryKey';
import type {UpdateUserInput} from './types/user';

// ── clientLoader ──────────────────────────────────────────────────────────────

export async function clientLoader({params, context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const logtoUserId = params.logtoUserId ?? '';

  await queryClient.ensureQueryData({
    queryKey: USER_QUERY_KEYS.detail(logtoUserId),
    queryFn: ({signal}) =>
      userQueries.fetchById({logtoUserId, signal, token: token ?? ''}),
  });

  return {logtoUserId};
}

// ── clientAction ──────────────────────────────────────────────────────────────

export async function clientAction({request, params, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const logtoUserId = params.logtoUserId ?? '';

  const formData: FormData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const payload = JSON.parse(raw) as UpdateUserInput;
    await userQueries.update(logtoUserId, payload, token ?? '');
    await queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.detail(logtoUserId)});
    await queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.list()});
    return {success: true as const};
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update user',
    };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserDetail() {
  const {logtoUserId} = useParams<{logtoUserId: string}>();
  const {t} = useTranslation('users');
  const {t: tCommon} = useTranslation('common');
  const {accessToken} = useAuth();

  const {data: user, isLoading, error} = useUser(logtoUserId ?? '');

  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [formDirty, setFormDirty] = useState(false);
  const isDirty = formDirty && !actionData?.success && !isSubmitting;

  const {showDialog, confirm, cancel} = useUnsavedChangesGuard(isDirty);
  const locationPrompt = useLocationChangePrompt(isDirty, '/users');

  const [deactivateOpen, setDeactivateOpen] = useState(false);

  // Form state — initialised from user data, tracks edits
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // Initialise form state when user data arrives
  if (user && !formInitialized) {
    setDisplayName(user.displayName ?? '');
    setNickname(user.nickname ?? '');
    setBio(user.bio ?? '');
    setTimezone(user.timezone ?? '');
    setPreferredLanguage(user.preferredLanguage ?? '');
    setEmailNotifications(user.emailNotifications);
    setSmsNotifications(user.smsNotifications);
    setMarketingEmails(user.marketingEmails);
    setFormInitialized(true);
  }

  // Photo mutations
  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) =>
      userQueries.uploadPhoto(logtoUserId ?? '', file, accessToken ?? ''),
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.detail(logtoUserId ?? '')}),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: () => userQueries.deletePhoto(logtoUserId ?? '', accessToken ?? ''),
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.detail(logtoUserId ?? '')}),
  });

  // Deactivate / restore mutations
  const deactivateMutation = useMutation({
    mutationFn: () => userQueries.deactivate(logtoUserId ?? '', accessToken ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.detail(logtoUserId ?? '')});
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.list()});
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => userQueries.restore(logtoUserId ?? '', accessToken ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.detail(logtoUserId ?? '')});
      queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.list()});
    },
  });

  const handleFieldChange = useCallback(
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setFormDirty(true);
    },
    [],
  );

  const handleToggleChange = useCallback(
    (setter: (v: boolean) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.checked);
      setFormDirty(true);
    },
    [],
  );

  function buildPayload(): UpdateUserInput {
    return {
      displayName: displayName || null,
      nickname: nickname || null,
      bio: bio || null,
      timezone: timezone || null,
      preferredLanguage: preferredLanguage || null,
      emailNotifications,
      smsNotifications,
      marketingEmails,
    };
  }

  function handleSave() {
    const form = document.getElementById('user-detail-form') as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    fd.set('payload', JSON.stringify(buildPayload()));
    form.requestSubmit();
    setFormDirty(false);
  }

  if (isLoading) {
    return (
      <Box sx={{display: 'flex', justifyContent: 'center', mt: 6}}>
        <CircularProgress />
      </Box>
    );
  }

  const displayLabel = user?.displayName ?? user?.email ?? '';
  const photoUrl = user?.hasProfilePhoto
    ? `${API_CONFIG.baseUrl}/user/${logtoUserId}/photo`
    : undefined;

  const isDeactivated = user?.isDeleted ?? false;

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[{label: t('title'), to: '/users'}, {label: displayLabel}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting || !isDirty}
            onClick={handleSave}
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? t('saving') : t('pageTitle.save')}
          </Button>
        }
      />

      <QueryErrorAlert error={error instanceof Error ? error : null} />

      {actionData?.success && (
        <HideAfterDelay delay={3000}>
          <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{mb: 2}}>
            {t('updateSuccess')}
          </Alert>
        </HideAfterDelay>
      )}

      {actionData && !actionData.success && (
        <Alert severity="error" sx={{mb: 2}}>
          {actionData.error}
        </Alert>
      )}

      <form id="user-detail-form" method="post">
        <input type="hidden" name="payload" />
      </form>

      <Box sx={{maxWidth: 600}}>
        {/* ── Read-only (Logto-managed) ── */}
        <Stack spacing={2} sx={{mb: 3}}>
          <Typography variant="subtitle2" color="text.secondary" sx={{fontWeight: 600}}>
            Logto-managed fields
          </Typography>
          <TextField
            label={t('fields.email')}
            value={user?.email ?? ''}
            size="small"
            fullWidth
            disabled
            helperText={t('fields.readOnlyHint')}
          />
          <TextField
            label={t('fields.username')}
            value={user?.username ?? ''}
            size="small"
            fullWidth
            disabled
            helperText={t('fields.readOnlyHint')}
          />
        </Stack>

        <Divider sx={{mb: 3}} />

        {/* ── Editable fields ── */}
        <Stack spacing={2} sx={{mb: 3}}>
          <TextField
            label={t('fields.displayName')}
            value={displayName}
            onChange={handleFieldChange(setDisplayName)}
            size="small"
            fullWidth
          />
          <TextField
            label={t('fields.nickname')}
            value={nickname}
            onChange={handleFieldChange(setNickname)}
            size="small"
            fullWidth
          />
          <TextField
            label={t('fields.bio')}
            value={bio}
            onChange={handleFieldChange(setBio)}
            size="small"
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label={t('fields.timezone')}
            value={timezone}
            onChange={handleFieldChange(setTimezone)}
            size="small"
            fullWidth
          />
          <TextField
            label={t('fields.preferredLanguage')}
            value={preferredLanguage}
            onChange={handleFieldChange(setPreferredLanguage)}
            size="small"
            fullWidth
          />
        </Stack>

        <Divider sx={{mb: 3}} />

        {/* ── Notification preferences ── */}
        <Stack spacing={1} sx={{mb: 3}}>
          <Typography variant="subtitle2" sx={{fontWeight: 600}}>
            {t('notifications.sectionTitle')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={emailNotifications}
                onChange={handleToggleChange(setEmailNotifications)}
                size="small"
              />
            }
            label={t('notifications.emailNotifications')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={smsNotifications}
                onChange={handleToggleChange(setSmsNotifications)}
                size="small"
              />
            }
            label={t('notifications.smsNotifications')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={marketingEmails}
                onChange={handleToggleChange(setMarketingEmails)}
                size="small"
              />
            }
            label={t('notifications.marketingEmails')}
          />
        </Stack>

        <Divider sx={{mb: 3}} />

        {/* ── Profile photo ── */}
        <Stack spacing={1.5} sx={{mb: 3}}>
          <Typography variant="subtitle2" sx={{fontWeight: 600}}>
            {t('photo.sectionTitle')}
          </Typography>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
            {photoUrl ? (
              <Box
                component="img"
                src={photoUrl}
                alt="Profile photo"
                sx={{width: 80, height: 80, borderRadius: '50%', objectFit: 'cover'}}
              />
            ) : (
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{fontSize: '0.75rem', color: 'text.secondary'}}>
                  No photo
                </Typography>
              </Box>
            )}
            <Stack spacing={1}>
              <Button
                variant="outlined"
                size="small"
                component="label"
                disabled={uploadPhotoMutation.isPending}
                sx={{textTransform: 'none'}}
              >
                {t('photo.upload')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhotoMutation.mutate(file);
                  }}
                />
              </Button>
              {user?.hasProfilePhoto && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  disabled={deletePhotoMutation.isPending}
                  onClick={() => deletePhotoMutation.mutate()}
                  sx={{textTransform: 'none'}}
                >
                  {t('photo.delete')}
                </Button>
              )}
            </Stack>
          </Box>
          {uploadPhotoMutation.isError && (
            <Alert severity="error">{t('photo.uploadError')}</Alert>
          )}
          {deletePhotoMutation.isError && (
            <Alert severity="error">{t('photo.deleteError')}</Alert>
          )}
        </Stack>

        <Divider sx={{mb: 3}} />

        {/* ── Deactivate / Reactivate ── */}
        <Box>
          <Button
            variant="outlined"
            color={isDeactivated ? 'primary' : 'error'}
            size="small"
            onClick={() => setDeactivateOpen(true)}
            disabled={deactivateMutation.isPending || restoreMutation.isPending}
            sx={{textTransform: 'none'}}
          >
            {isDeactivated ? t('reactivate.button') : t('deactivate.button')}
          </Button>
        </Box>
      </Box>

      <DeactivateDialog
        open={deactivateOpen}
        userName={displayLabel}
        mode={isDeactivated ? 'reactivate' : 'deactivate'}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => {
          setDeactivateOpen(false);
          if (isDeactivated) {
            restoreMutation.mutate();
          } else {
            deactivateMutation.mutate();
          }
        }}
      />

      <UnsavedChangesDialog
        open={showDialog}
        message={t('unsavedChanges.editMessage')}
        onConfirm={confirm}
        onCancel={cancel}
      />
      <UnsavedChangesDialog
        open={locationPrompt.showDialog}
        message={tCommon('locationChangePrompt')}
        onConfirm={locationPrompt.confirm}
        onCancel={locationPrompt.cancel}
      />
    </Box>
  );
}
