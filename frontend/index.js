// Ensure TaskManager definitions are loaded from app entry so iOS can execute
// background notification tasks when the app is terminated.
import './src/lib/backgroundWidgetTask';
import 'expo-router/entry';
