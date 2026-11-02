import { Alert, Platform } from 'react-native';

/** Cross-platform confirmation. react-native-web does not implement Alert buttons. */
export function confirmAction(opts: { title: string; message: string; confirm: string; cancel: string; destructive?: boolean; onConfirm: () => void }) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${opts.title}\n\n${opts.message}`)) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: opts.cancel, style: 'cancel' },
    { text: opts.confirm, style: opts.destructive ? 'destructive' : 'default', onPress: opts.onConfirm },
  ]);
}
