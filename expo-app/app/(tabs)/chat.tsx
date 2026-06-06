import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { haversineMetres } from '../../src/utils/haversine';
import * as voice from '../../src/utils/voice';
import { callAnthropic } from '../../src/utils/anthropic';
import { buildBikAISystemPrompt, type LandmarkInfo } from '../../src/utils/systemPrompt';
import { dedupeBySlug } from '../../src/utils/landmarks';
import { parseLocalIntent } from '../../src/intents/router';
import { phrases } from '../../src/intents/phrases';
import { detectLang } from '../../src/utils/locale';
import { useVoiceChat } from '../../src/hooks/useVoiceChat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "What's near me right now?",
  'Is it safe to ride here?',
  'Where can I park my bike?',
  'What are the cycling rules here?',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Voice/TTS state is global (Settings ↔ this header toggle share it).
  const speakerOn = useSettingsStore((s) => s.voiceGuidanceEnabled);
  const setVoiceGuidanceEnabled = useSettingsStore((s) => s.setVoiceGuidanceEnabled);
  const appLocale = useSettingsStore((s) => s.appLocale);
  const [landmarks, setLandmarks] = useState<LandmarkInfo[]>([]);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Shared voice capture (tap-to-stop here; the map uses silence auto-stop). On a
  // recognized transcript, send it straight to BikAI — fully hands-free.
  const { isListening, transcribing, startListening, stopListening } = useVoiceChat({
    onTranscript: (text) => void sendMessage(text),
    phrases: () => landmarks.map((l) => l.name).filter(Boolean),
    onError: (msg) => Alert.alert('Voice', msg),
  });

  const router = useRouter();
  const chatPrefill = useAppStore((s) => s.chatPrefill);
  const setChatPrefill = useAppStore((s) => s.setChatPrefill);
  const setNavRequest = useAppStore((s) => s.setNavRequest);
  // activeName seeds the suggested-question chips; the full live geofence context
  // is read inside buildBikAISystemPrompt via the store directly.
  const activeName = useAppStore((s) => s.activeName);
  const userLat = useAppStore((s) => s.userLat);
  const userLng = useAppStore((s) => s.userLng);

  const nearestLandmark = useMemo((): LandmarkInfo | null => {
    if (userLat == null || userLng == null || landmarks.length === 0) return null;
    let best: LandmarkInfo | null = null;
    let bestDist = 1000;
    for (const lm of landmarks) {
      const coords = lm.coordinates;
      if (!coords) continue;
      const d = haversineMetres(userLat, userLng, coords.latitude, coords.longitude);
      if (d < bestDist) { bestDist = d; best = lm; }
    }
    return best;
  }, [userLat, userLng, landmarks]);

  const contextName = activeName || nearestLandmark?.name || null;

  const suggestions = useMemo(() => {
    if (contextName) {
      return [
        `Tell me about ${contextName}`,
        `Is it safe to cycle at ${contextName}?`,
        `Where can I park near ${contextName}?`,
        `What are the cycling rules at ${contextName}?`,
      ];
    }
    return SUGGESTED;
  }, [contextName]);

  // Load landmarks for context
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'locations'), where('is_active', '==', true)),
        );
        setLandmarks(dedupeBySlug(snap.docs.map((d) => d.data() as LandmarkInfo)));
      } catch (e) {
        console.warn('[Chat] landmark fetch failed', e);
      }
    })();
  }, []);

  // Pre-fill from "Ask AI about this place" button on map
  useEffect(() => {
    if (chatPrefill) {
      setInput(chatPrefill);
      setChatPrefill('');
    }
  }, [chatPrefill, setChatPrefill]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Live-guidance handoff: a navigate command typed/spoken in chat starts REAL
    // turn-by-turn on the map (grounded in live location), instead of a static
    // step list. The map consumes navRequest and speaks "Heading to X".
    const local = parseLocalIntent(trimmed, appLocale);
    if (local && local.kind === 'navigate') {
      voice.stop();
      setNavRequest(local.query);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: trimmed },
        { id: (Date.now() + 1).toString(), role: 'assistant', content: phrases(appLocale).routing(local.query) },
      ]);
      setInput('');
      router.push('/(tabs)/map');
      return;
    }

    voice.stop();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      // No forced locale → Claude replies in the SAME language the user wrote in
      // (typed French → French, etc.). For voice input the transcript is already
      // in the Settings language, so the reply matches that too.
      const aiText = await callAnthropic(
        buildBikAISystemPrompt(landmarks),
        history.map(({ role, content }) => ({ role, content })),
      );
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: aiText },
      ]);
      // Speak through the shared queue (self-gates on voiceGuidanceEnabled).
      // priority 'high' so an explicit answer beats ambient ride cues. Pick the
      // TTS voice from the reply's detected language so text and voice agree.
      voice.speak(aiText, { lang: detectLang(aiText, appLocale), rate: 0.92, priority: 'high' });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            'Sorry, something went wrong. Check your API key and try again.',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.msgRow,
        item.role === 'user' ? styles.msgRowUser : styles.msgRowAI,
      ]}
    >
      <View
        style={[
          styles.bubble,
          item.role === 'user' ? styles.bubbleUser : styles.bubbleAI,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            item.role === 'user' ? styles.textUser : styles.textAI,
          ]}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );

  const isEmpty = messages.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with speaker toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BikAI</Text>
        <TouchableOpacity
          onPress={() => { setVoiceGuidanceEnabled(!speakerOn); voice.stop(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={speakerOn ? 'volume-high' : 'volume-mute'}
            size={22}
            color={speakerOn ? '#00C853' : '#555'}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        {/* Empty state with suggested questions */}
        {isEmpty ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={52} color="#444" />
            <Text style={styles.emptyTitle}>Ask me anything about your ride</Text>
            <View style={styles.suggestionList}>
              {suggestions.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.suggestionBtn}
                  onPress={() => void sendMessage(q)}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#555" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Typing indicator */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#00C853" />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        )}

        {/* Listening hint */}
        {(isListening || transcribing) && (
          <View style={styles.listeningHint}>
            <Text style={styles.listeningHintText}>
              {transcribing ? '⏳ Transcribing…' : '🎙 Listening — tap ■ to send'}
            </Text>
          </View>
        )}

        {/* Input bar — one elevated rounded dock holding mic + field + send */}
        <View style={styles.inputBarOuter}>
          <View style={styles.inputDock}>
            <TouchableOpacity
              style={[styles.micBtn, isListening && styles.micBtnActive]}
              onPress={() => void (isListening ? stopListening() : startListening())}
              disabled={transcribing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {transcribing ? (
                <ActivityIndicator size="small" color="#9E9E9E" />
              ) : (
                <Ionicons
                  name={isListening ? 'stop-circle' : 'mic'}
                  size={22}
                  color={isListening ? '#EF5350' : '#9E9E9E'}
                />
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Message BikAI…"
              placeholderTextColor="#7A7A7A"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={400}
              returnKeyType="send"
              onSubmitEditing={() => void sendMessage(input)}
              blurOnSubmit
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
              onPress={() => void sendMessage(input)}
              disabled={!input.trim() || loading}
              activeOpacity={0.85}
            >
              <Ionicons
                name="send"
                size={18}
                color={!input.trim() || loading ? '#6B6B6B' : '#0A0A0A'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
    fontWeight: '500',
  },
  suggestionList: { width: '100%', gap: 10 },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  suggestionText: { color: '#E0E0E0', fontSize: 14, flex: 1 },

  messageList: { paddingHorizontal: 12, paddingVertical: 16, gap: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#00C853', borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: '#2A2A2A', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  textUser: { color: '#fff' },
  textAI: { color: '#E0E0E0' },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: { color: '#666', fontSize: 13 },
  listeningHint: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  listeningHintText: { color: '#EF5350', fontSize: 12, textAlign: 'center' },

  inputBarOuter: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#121212',
  },
  inputDock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#202022',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#34343A',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
    // Float the dock above the message list — same look on both platforms
    // (iOS reads shadow*, Android reads elevation).
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingTop: 9,
    paddingBottom: 9,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    backgroundColor: 'transparent', // the field is part of the dock, not its own pill
    textAlignVertical: 'center',    // Android: center text like iOS
    includeFontPadding: false,      // Android: drop extra top/bottom font padding
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#4A0000' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00E676', // brighter, more saturated than the old #00C853
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E676',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  sendBtnOff: {
    backgroundColor: '#2C2C30', // matches the mic track → clearly disabled
    shadowOpacity: 0,
    elevation: 0,
  },
});
