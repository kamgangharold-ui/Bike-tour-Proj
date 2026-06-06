// ─── Map tap-to-talk button ───────────────────────────────────────────────────
// A large, look-free hit target shown during an active ride. Four visual states:
// idle → listening (red, pulsing) → thinking (spinner) → speaking (blue). Tapping
// while speaking interrupts (barge-in) — the parent handles the actual mic logic;
// this is presentational + onPress.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MicState = 'idle' | 'listening' | 'thinking' | 'speaking';

const COLORS: Record<MicState, string> = {
  idle: '#1565C0',
  listening: '#C62828',
  thinking: '#37474F',
  speaking: '#00C853',
};

export default function MicButton({
  state,
  onPress,
  bottom,
  right = 2,
}: {
  state: MicState;
  onPress: () => void;
  bottom: number;
  right?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== 'listening') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const icon =
    state === 'listening' ? 'stop' : state === 'speaking' ? 'volume-high' : 'mic';

  return (
    <View style={[styles.wrap, { bottom, right }]} pointerEvents="box-none">
      {state === 'listening' && (
        <Animated.View
          style={[
            styles.ring,
            { backgroundColor: COLORS.listening, transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
      )}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: COLORS[state] }]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityLabel="Tap to talk"
      >
        {state === 'thinking' ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Ionicons name={icon} size={34} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const SIZE = 72;
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
});
