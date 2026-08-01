/**
 * Pick a photo from the camera or library and return a small **data URL**,
 * mirroring the web resize (apps/web/lib/image.ts):
 *   - avatar → square 256×256 JPEG (q0.85)
 *   - logo   → contained to ≤256px on the longest side, PNG
 * The API stores these inline in `avatarUrl` / `logoUrl` (data URL, ≤500 KB).
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type PhotoMode = 'avatar' | 'logo';
export type PhotoSource = 'camera' | 'library';

/** Present the native Take photo / Choose from library / (Remove) chooser. */
export function choosePhotoSource(
  onPick: (source: PhotoSource) => void,
  opts?: { onRemove?: () => void },
) {
  Alert.alert('Photo', undefined, [
    { text: 'Take photo', onPress: () => onPick('camera') },
    { text: 'Choose from library', onPress: () => onPick('library') },
    ...(opts?.onRemove ? [{ text: 'Remove', style: 'destructive' as const, onPress: opts.onRemove }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/** Launch the picker + resize; returns a data URL, or null if cancelled/denied. */
export async function pickPhotoDataUrl(mode: PhotoMode, source: PhotoSource): Promise<string | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      source === 'camera' ? 'Camera access needed' : 'Photo access needed',
      'Enable it in your phone Settings to add a photo.',
    );
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 1,
          ...(mode === 'avatar' ? { aspect: [1, 1] as [number, number] } : {}),
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 1,
          ...(mode === 'avatar' ? { aspect: [1, 1] as [number, number] } : {}),
        });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  if (mode === 'avatar') {
    const out = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 256, height: 256 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  }

  // logo: preserve aspect, fit the longest side to 256px, PNG
  const landscape = (asset.width ?? 1) >= (asset.height ?? 1);
  const out = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: landscape ? { width: 256 } : { height: 256 } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  return out.base64 ? `data:image/png;base64,${out.base64}` : null;
}
