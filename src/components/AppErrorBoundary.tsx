import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { unrot, unrotFonts } from '../theme';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  resetKey: number;
};

/** Catches render crashes so the app shows a recovery screen instead of a black screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Pick<State, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  private onRetry = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.error == null) {
      return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
    }
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Reload the app. If you use a dev build, start Metro with{' '}
          <Text style={styles.em}>npm run ios:dev</Text> on your Mac first.
        </Text>
        <Pressable onPress={this.onRetry} style={styles.btn}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 28,
    justifyContent: 'center',
  },
  title: {
    fontFamily: unrotFonts.heroSerif,
    fontSize: 22,
    color: unrot.ink,
    marginBottom: 12,
  },
  body: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: unrot.muted,
    marginBottom: 24,
  },
  em: {
    fontFamily: unrotFonts.interRegular,
    color: unrot.ink,
  },
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  btnText: {
    fontFamily: unrotFonts.interRegular,
    fontSize: 15,
    color: unrot.ink,
    textDecorationLine: 'underline',
  },
});
