import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {useTranslation} from 'react-i18next';

interface DeactivateDialogProps {
  open: boolean;
  userName: string;
  mode?: 'deactivate' | 'reactivate';
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateDialog({
  open,
  userName,
  mode = 'deactivate',
  onClose,
  onConfirm,
}: DeactivateDialogProps) {
  const {t} = useTranslation('users');

  if (mode === 'reactivate') {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reactivate.confirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('reactivate.confirmMessage', {name: userName})}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose}>
            {t('reactivate.cancel')}
          </Button>
          <Button variant="contained" color="primary" onClick={onConfirm}>
            {t('reactivate.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('deactivate.confirmTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('deactivate.confirmMessage', {name: userName})}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          {t('deactivate.cancel')}
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          {t('deactivate.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
