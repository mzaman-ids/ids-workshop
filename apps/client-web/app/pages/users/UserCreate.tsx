import {valibotResolver} from '@hookform/resolvers/valibot';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {Breadcrumb} from 'components/Breadcrumb';
import {ApiError} from 'core/config/apiErrors';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {Controller, useForm} from 'react-hook-form';
import {useTranslation} from 'react-i18next';
import {
  type ClientActionFunctionArgs,
  type Navigation,
  useActionData,
  useNavigate,
  useNavigation,
} from 'react-router';
import {userQueries} from './queries/userQueries';
import {USER_QUERY_KEYS} from './queries/userQueryKey';
import {type CreateUserFormValues, createUserSchema} from './schemas/userSchema';

// ── clientAction ──────────────────────────────────────────────────────────────

export async function clientAction({request, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  const formData: FormData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'invalid-form' as const};
  }

  try {
    const payload = JSON.parse(raw) as CreateUserFormValues;
    await userQueries.create(
      {
        email: payload.email,
        password: payload.password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username || undefined,
      },
      token ?? '',
    );
    await queryClient.invalidateQueries({queryKey: USER_QUERY_KEYS.all()});
    return {success: true as const};
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return {success: false as const, error: 'email-conflict' as const};
    }
    return {
      success: false as const,
      error: (err instanceof Error ? err.message : 'Failed to create user') as string,
    };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserCreate() {
  const navigate = useNavigate();
  const {t} = useTranslation('users');
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<CreateUserFormValues>({
    resolver: valibotResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      username: '',
    },
  });

  // On success, navigate to users list
  if (actionData?.success) {
    navigate('/users');
  }

  // Show inline email error for 409
  const emailConflict = actionData && !actionData.success && actionData.error === 'email-conflict';
  const generalError =
    actionData && !actionData.success && actionData.error !== 'email-conflict' && actionData.error !== 'invalid-form'
      ? (actionData.error as string)
      : null;

  function onSubmit(values: CreateUserFormValues) {
    const form = document.getElementById('user-create-form') as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    formData.set('payload', JSON.stringify(values));
    form.requestSubmit();
  }

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[{label: t('title'), to: '/users'}, {label: t('pageTitle.create')}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting}
            onClick={() => document.getElementById('user-create-submit')?.click()}
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? t('saving') : t('pageTitle.create')}
          </Button>
        }
      />

      <Box sx={{maxWidth: 480, mt: 3}}>
        {generalError && (
          <Alert severity="error" sx={{mb: 2}}>
            {generalError}
          </Alert>
        )}

        <form
          id="user-create-form"
          onSubmit={handleSubmit(onSubmit)}
          method="post"
        >
          <input type="hidden" name="payload" />
          <button type="submit" id="user-create-submit" style={{display: 'none'}} />

          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('fields.firstName')} / {t('fields.lastName')}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Controller
                name="firstName"
                control={control}
                render={({field}) => (
                  <TextField
                    {...field}
                    label={t('fields.firstName')}
                    size="small"
                    fullWidth
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message}
                  />
                )}
              />
              <Controller
                name="lastName"
                control={control}
                render={({field}) => (
                  <TextField
                    {...field}
                    label={t('fields.lastName')}
                    size="small"
                    fullWidth
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                  />
                )}
              />
            </Stack>

            <Controller
              name="email"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  label={t('fields.email')}
                  type="email"
                  size="small"
                  fullWidth
                  error={!!errors.email || !!emailConflict}
                  helperText={
                    emailConflict
                      ? t('create.emailConflict')
                      : errors.email?.message
                  }
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  label={t('fields.password')}
                  type="password"
                  size="small"
                  fullWidth
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
              )}
            />

            <Controller
              name="username"
              control={control}
              render={({field}) => (
                <TextField
                  {...field}
                  label={`${t('fields.username')} (optional)`}
                  size="small"
                  fullWidth
                  error={!!errors.username}
                  helperText={errors.username?.message}
                />
              )}
            />
          </Stack>
        </form>
      </Box>
    </Box>
  );
}
