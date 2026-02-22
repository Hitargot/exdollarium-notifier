import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary — catches any unhandled React render errors anywhere
 * below it in the tree and shows a friendly recovery screen instead of a
 * blank/crashed app.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; swap in a remote logger (Sentry etc.) here later
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={56} color="#e74c3c" />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          An unexpected error occurred. Please try again.
        </Text>
        {__DEV__ && this.state.error ? (
          <ScrollView style={styles.devBox}>
            <Text style={styles.devText}>{this.state.error.toString()}</Text>
          </ScrollView>
        ) : null}
        <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1a3a',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  devBox: {
    backgroundColor: '#1a2744',
    borderRadius: 8,
    padding: 12,
    maxHeight: 180,
    width: '100%',
    marginBottom: 24,
  },
  devText: {
    color: '#fc8181',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#162660',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
