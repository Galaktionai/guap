import { router } from 'expo-router';

/**
 * Goes back, or to the home screen when there is nothing to go back to
 * (for example when the screen was opened from a deep link).
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
