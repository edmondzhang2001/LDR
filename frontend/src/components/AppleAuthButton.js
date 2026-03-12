import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Native "Sign in with Apple" button. Only render on iOS when Apple Auth is available.
 * onPress should trigger the login flow (e.g. call signInWithApple from the auth store).
 */
export default function AppleAuthButton({ onPress, disabled, style }) {
  if (Platform.OS !== 'ios') return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={24}
      onPress={onPress}
      disabled={disabled}
      style={style}
    />
  );
}
