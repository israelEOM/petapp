import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  background?: string;
  statusBar?: 'light' | 'dark';
  /** wrap content in a ScrollView (with keyboard avoidance) */
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area page shell with the app background and side gutters. */
export function Screen({
  children,
  background = colors.bg,
  statusBar = 'dark',
  scroll = false,
  edges = ['top', 'bottom'],
  contentStyle,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }]}>
      <StatusBar style={statusBar} />
      {scroll ? (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, styles.grow, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.root, styles.content, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 16 },
  grow: { flexGrow: 1 },
});
