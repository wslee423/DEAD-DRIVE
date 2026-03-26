import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const LANE_W = SCREEN_W / 3;
const CAR_W = LANE_W * 0.48;
const CAR_H = CAR_W * 1.7;
const CAR_BOTTOM = 90;
const DASH_HEIGHT = 22;
const DASH_GAP = 22;
const DASH_COUNT = Math.ceil(SCREEN_H / (DASH_HEIGHT + DASH_GAP));

function DashedLane({ x }: { x: number }) {
  return (
    <>
      {Array.from({ length: DASH_COUNT }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x - 1,
            top: i * (DASH_HEIGHT + DASH_GAP),
            width: 2,
            height: DASH_HEIGHT,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
      ))}
    </>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [lane, setLane] = useState(1); // 0 = left, 1 = center, 2 = right

  const moveLeft = () => setLane((prev) => Math.max(0, prev - 1));
  const moveRight = () => setLane((prev) => Math.min(2, prev + 1));

  const carLeft = lane * LANE_W + (LANE_W - CAR_W) / 2;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Road */}
      <View style={styles.road}>
        {/* Dashed lane dividers */}
        <DashedLane x={LANE_W} />
        <DashedLane x={LANE_W * 2} />

        {/* Car */}
        <View style={[styles.car, { left: carLeft, bottom: CAR_BOTTOM }]}>
          <View style={styles.carRoof} />
          <View style={styles.carBody} />
        </View>
      </View>

      {/* Tap zones — active only when game is running */}
      {started && (
        <>
          <TouchableOpacity
            style={[styles.tapZone, { left: 0 }]}
            onPress={moveLeft}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={[styles.tapZone, { right: 0 }]}
            onPress={moveRight}
            activeOpacity={1}
          />
        </>
      )}

      {/* Start overlay */}
      {!started && (
        <View style={styles.overlay}>
          <Text style={styles.title}>DEAD DRIVE</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setStarted(true)}
          >
            <Text style={styles.startBtnText}>START</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  road: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#222',
  },
  car: {
    position: 'absolute',
    width: CAR_W,
    height: CAR_H,
    alignItems: 'center',
  },
  carRoof: {
    width: CAR_W * 0.6,
    height: CAR_H * 0.4,
    backgroundColor: '#005fa3',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  carBody: {
    width: CAR_W,
    height: CAR_H * 0.6,
    backgroundColor: '#0088dd',
    borderRadius: 5,
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_W / 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff2222',
    letterSpacing: 4,
    marginBottom: 64,
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  startBtn: {
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingHorizontal: 52,
    paddingVertical: 16,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
  },
});
