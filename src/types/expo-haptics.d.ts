/**
 * Minimal ambient type declarations for `expo-haptics` to silence TS errors
 * when the package isn't installed or when full types aren't available.
 *
 * If you plan to use haptics at runtime, prefer installing the real package:
 *   expo install expo-haptics
 *
 * This file only provides a permissive `any` surface so the code that
 * conditionally requires `expo-haptics` (via try/require) compiles cleanly.
 */

declare module 'expo-haptics' {
  export const NotificationFeedbackType: any;
  export function notificationAsync(...args: any[]): Promise<any>;
  export function impactAsync(...args: any[]): Promise<any>;
  export function selectionAsync(...args: any[]): Promise<any>;

  // A minimal representation of ImpactFeedbackStyle
  export const ImpactFeedbackStyle: {
    Light: any;
    Medium: any;
    Heavy: any;
  };

  const _default: any;
  export default _default;
}
