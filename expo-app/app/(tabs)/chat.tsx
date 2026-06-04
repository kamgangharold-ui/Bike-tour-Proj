import { useState, useEffect, useRef } from 'react';
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
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase/config';
import { useAppStore } from '../../src/store/useAppStore';
import { haversineMetres } from '../../src/utils/haversine';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface LandmarkInfo {
  name: string;
  short_description?: string;
  category?: string;
  coordinates?: { latitude: number; longitude: number };
  regulatory_alert?: { message?: string; fine_eur?: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SUGGESTED = [
  "What's near me right now?",
  'Is it safe to ride here?',
  'Where can I park my bike?',
  'What are the cycling rules here?',
];

// Direct fetch wrapper — avoids Node.js built-ins in @anthropic-ai/sdk
async function callAnthropic(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  const first = data.content[0];
  return first?.type === 'text' ? first.text : 'No response generated.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkInfo[]>([]);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meterInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingStarted = useRef(false);
  const lastSpokeAt = useRef(0);

  const chatPrefill = useAppStore((s) => s.chatPrefill);
  const setChatPrefill = useAppStore((s) => s.setChatPrefill);
  const activeSlug = useAppStore((s) => s.activeSlug);
  const activeName = useAppStore((s) => s.activeName);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeDescription = useAppStore((s) => s.activeDescription);
  const activeIsRegulatory = useAppStore((s) => s.activeIsRegulatory);
  const activeRegulatoryMessage = useAppStore((s) => s.activeRegulatoryMessage);
  const activeRegulatoryFineEur = useAppStore((s) => s.activeRegulatoryFineEur);

  // Location — continuous tracking so coordinates are never stale
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      );
    })();
    return () => { sub?.remove(); };
  }, []);

  // Load landmarks for context
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'locations'), where('is_active', '==', true)),
        );
        setLandmarks(snap.docs.map((d) => d.data() as LandmarkInfo));
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

  // ── Voice recording + Google STT ─────────────────────────────────────────────
  const stopAndTranscribe = async (rec: Audio.Recording) => {
    if (recordingTimer.current) { clearTimeout(recordingTimer.current); recordingTimer.current = null; }
    if (meterInterval.current) { clearInterval(meterInterval.current); meterInterval.current = null; }
    setIsListening(false);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setRecording(null);
      if (uri) void transcribeAudio(uri);
    } catch (e) {
      console.warn('[Voice] stop failed', e);
      setRecording(null);
    }
  };

  const handleVoice = async () => {
    if (isListening) {
      if (recording) void stopAndTranscribe(recording);
    } else {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Microphone access is required for voice input.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync({
          isMeteringEnabled: true,
          android: {
            extension: '.amr',
            outputFormat: Audio.AndroidOutputFormat.AMR_WB,
            audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 23850,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
        });
        setRecording(rec);
        setIsListening(true);
        // VAD: auto-stop after 1.5s of silence following speech
        speakingStarted.current = false;
        lastSpokeAt.current = 0;
        meterInterval.current = setInterval(async () => {
          try {
            const status = await rec.getStatusAsync();
            if (!status.isRecording) return;
            const level = (status as { metering?: number }).metering ?? -160;
            if (level > -40) {
              speakingStarted.current = true;
              lastSpokeAt.current = Date.now();
            } else if (speakingStarted.current && Date.now() - lastSpokeAt.current > 1500) {
              if (meterInterval.current) { clearInterval(meterInterval.current); meterInterval.current = null; }
              void stopAndTranscribe(rec);
            }
          } catch { /* ignore */ }
        }, 200);
        // Hard 45s fallback
        recordingTimer.current = setTimeout(() => void stopAndTranscribe(rec), 45000);
      } catch (e) {
        console.warn('[Voice] start failed', e);
        Alert.alert('Mic error', `Could not start recording: ${String(e)}`);
      }
    }
  };

  const transcribeAudio = async (uri: string) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!apiKey) {
      Alert.alert('Missing API key', 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set.');
      return;
    }
    setTranscribing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: Platform.OS === 'android' ? 'AMR_WB' : 'LINEAR16',
              sampleRateHertz: 16000,
              languageCode: 'en-US',
              alternativeLanguageCodes: ['es-ES', 'fr-FR'],
              model: 'latest_short',
              enableAutomaticPunctuation: true,
            },
            audio: { content: base64 },
          }),
        },
      );
      const data = await res.json() as {
        results?: Array<{ alternatives: Array<{ transcript: string }> }>;
        error?: { message: string; status: string };
      };
      if (data.error) {
        Alert.alert('Speech API error', `${data.error.status}: ${data.error.message}`);
        return;
      }
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript ?? '';
      if (transcript) {
        setInput(transcript);
      } else {
        Alert.alert('No speech detected', 'Nothing was heard. Speak clearly and try again.');
      }
    } catch (e) {
      console.warn('[Voice] transcribe failed', e);
      Alert.alert('Transcription failed', String(e));
    } finally {
      setTranscribing(false);
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  // ── System prompt builder ────────────────────────────────────────────────────
  const buildSystemPrompt = (): string => {
    const lat = userLocation?.latitude ?? 0;
    const lng = userLocation?.longitude ?? 0;

    let nearbyStr: string;
    if (!userLocation) {
      nearbyStr = 'Location unavailable';
    } else {
      const nearby = landmarks
        .map((loc) => {
          const c = loc.coordinates;
          if (!c) return null;
          const dist = Math.round(haversineMetres(lat, lng, c.latitude, c.longitude));
          const regNote = loc.regulatory_alert?.message
            ? ` ⚠️ ${loc.regulatory_alert.message}`
            : '';
          return { name: loc.name, dist, desc: loc.short_description ?? '', regNote };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null && l.dist <= 500)
        .sort((a, b) => a.dist - b.dist)
        .map((l) => `- ${l.name} (${l.dist}m)${l.regNote}: ${l.desc}`);
      nearbyStr = nearby.length > 0 ? nearby.join('\n') : 'None within 500 m';
    }

    const geofenceSection = activeSlug
      ? `CURRENT LOCATION (geofence confirmed): ${activeName} [${activeCategory}]\n` +
        `Description: ${activeDescription}\n` +
        (activeIsRegulatory
          ? `⚠️ Regulatory alert: €${activeRegulatoryFineEur} fine — ${activeRegulatoryMessage}\n`
          : '')
      : '';

    return (
      `You are BikAI, a cycling guide assistant for bike tourists in Barcelona.\n` +
      (geofenceSection
        ? `${geofenceSection}\n`
        : `The user's GPS position: [${lat.toFixed(5)}, ${lng.toFixed(5)}].\n`) +
      `Nearby landmarks within 500 m:\n${nearbyStr}\n` +
      (activeSlug
        ? `The geofence confirms the user is physically at ${activeName}. Treat this as their definitive location.\n`
        : '') +
      `Cycling regulations: sidewalk riding = €500 fine, ` +
      `both earphones = €100 fine, Gothic Quarter = mandatory dismount zone.\n` +
      `Answer concisely and helpfully. If unsure, say so honestly. ` +
      `Respond in the same language the user writes in. ` +
      `Use plain text only — no markdown (no **, no ##, no ---, no > blocks). Emojis are fine.`
    );
  };

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    Speech.stop();

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
      const aiText = await callAnthropic(
        buildSystemPrompt(),
        history.map(({ role, content }) => ({ role, content })),
      );
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: aiText },
      ]);
      if (speakerOn) {
        const lang = /\b(je|vous|est|les|des|une|du|en|nous|qui|que|pas|sur|plus)\b/i.test(aiText)
          ? 'fr'
          : 'en';
        Speech.speak(aiText, { language: lang, rate: 0.92, pitch: 1.0 });
      }
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
        <Text style={styles.headerTitle}>BikAI Guide</Text>
        <TouchableOpacity
          onPress={() => { setSpeakerOn((p) => !p); Speech.stop(); }}
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
              {SUGGESTED.map((q) => (
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

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            onPress={() => void handleVoice()}
            disabled={transcribing}
          >
            {transcribing ? (
              <ActivityIndicator size="small" color="#9E9E9E" />
            ) : (
              <Ionicons
                name={isListening ? 'stop-circle' : 'mic'}
                size={20}
                color={isListening ? '#EF5350' : '#9E9E9E'}
              />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Ask about cycling, landmarks, rules…"
            placeholderTextColor="#666"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
            returnKeyType="send"
            onSubmitEditing={() => void sendMessage(input)}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnOff,
            ]}
            onPress={() => void sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
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

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#4A0000' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00C853',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: '#333' },
});
