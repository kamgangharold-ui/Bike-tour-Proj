// ─── Voice debug overlay (TEMPORARY — __DEV__ only, remove before ship) ────────────
// Metro shows nothing useful, so this floats a live readout of every voice-pipeline
// step on the phone (screenshot it to see exactly where it breaks). Two isolation
// tests prove the foundation in isolation:
//   • 🔊 Speak test  → expo-speech speaks "hello" (shows onDone/onError)
//   • 🎙 Record test → record → Google STT (shows duration/bytes/format/transcript)
// Collapsed to a small 🐞 chip by default so it never blocks the UI.

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceDebug } from '../store/useVoiceDebug';
import { useVoiceChat } from '../hooks/useVoiceChat';
import * as voice from '../utils/voice';

export default function VoiceDebugOverlay() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const lines = useVoiceDebug((s) => s.lines);
  const clear = useVoiceDebug((s) => s.clear);

  // Isolation record→transcribe test (transcribe() already logs the result/errors).
  const rec = useVoiceChat({ onTranscript: () => {}, onError: () => {}, silenceMs: 2000, maxMs: 8000 });

  if (!open) {
    return (
      <TouchableOpacity
        style={[styles.fab, { top: insets.top + 6 }]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Open voice debug"
      >
        <Text style={styles.fabText}>STT</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.card} pointerEvents="auto">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Voice debug</Text>
          <TouchableOpacity onPress={clear} hitSlop={HIT}><Text style={styles.btn}>Clear</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setOpen(false)} hitSlop={HIT}><Text style={styles.btn}>Hide</Text></TouchableOpacity>
        </View>
        <View style={styles.testRow}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={() => voice.speak('Hello. This is a BikAI voice test.', { lang: 'en', priority: 'high' })}
          >
            <Text style={styles.testText}>🔊 Speak test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testBtn, rec.isListening && styles.testBtnActive]}
            onPress={() => void (rec.isListening ? rec.stopListening() : rec.startListening())}
          >
            <Text style={styles.testText}>
              {rec.transcribing ? '⏳ transcribing' : rec.isListening ? '■ stop' : '🎙 Record test'}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.log} contentContainerStyle={{ paddingBottom: 6 }}>
          {lines.length === 0 ? (
            <Text style={styles.empty}>Tap a test, or use the real mic. Each step appears here.</Text>
          ) : (
            lines.map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 8,
    zIndex: 3000,
    backgroundColor: '#000000AA',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fabText: { fontSize: 10, fontWeight: '800', color: '#00E676', letterSpacing: 0.5 },
  wrap: { position: 'absolute', left: 8, right: 8, zIndex: 3000 },
  card: {
    backgroundColor: '#000000E6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00C853',
    padding: 8,
    maxHeight: 320,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  title: { color: '#00E676', fontWeight: '800', fontSize: 13, flex: 1 },
  btn: { color: '#9E9E9E', fontSize: 12, fontWeight: '700' },
  testRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  testBtn: { flex: 1, backgroundColor: '#1E1E1E', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  testBtnActive: { backgroundColor: '#4A0000' },
  testText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  log: { maxHeight: 220 },
  empty: { color: '#777', fontSize: 11, fontStyle: 'italic' },
  line: {
    color: '#D0D0D0',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
