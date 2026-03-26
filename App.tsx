import React, { useState, useEffect, useRef } from 'react';
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

const ZOMBIE_W = LANE_W * 0.46;
const ZOMBIE_H = ZOMBIE_W * 1.2;
const ZOMBIE_SPEED = 4;        // px per frame
const SPAWN_EVERY = 90;        // frames (~1.5s at 60fps)
const FRAME_MS = 16;

const DASH_HEIGHT = 22;
const DASH_GAP = 22;
const DASH_COUNT = Math.ceil(SCREEN_H / (DASH_HEIGHT + DASH_GAP));

// ── Zombie type (좌표 구조: 나중에 충돌 판정에 그대로 사용 가능) ──
type Zombie = {
  id: number;
  lane: number;  // 0 | 1 | 2
  y: number;     // top (px, 화면 위쪽 기준)
};

// ── 차선 분리선 ──
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

// ── 좀비 컴포넌트 ──
function ZombieView({ zombie }: { zombie: Zombie }) {
  const left = zombie.lane * LANE_W + (LANE_W - ZOMBIE_W) / 2;
  return (
    <View
      style={[
        styles.zombie,
        { left, top: zombie.y, width: ZOMBIE_W, height: ZOMBIE_H },
      ]}
    >
      <Text style={styles.zombieText}>Z</Text>
    </View>
  );
}

// ── 메인 ──
export default function App() {
  const [started, setStarted] = useState(false);
  const [lane, setLane] = useState(1); // 0 = left, 1 = center, 2 = right
  const [zombies, setZombies] = useState<Zombie[]>([]);

  const zombiesRef = useRef<Zombie[]>([]);
  const frameRef = useRef(0);
  const nextIdRef = useRef(0);

  const moveLeft = () => setLane((prev) => Math.max(0, prev - 1));
  const moveRight = () => setLane((prev) => Math.min(2, prev + 1));

  // ── 게임 루프 ──
  useEffect(() => {
    if (!started) {
      zombiesRef.current = [];
      frameRef.current = 0;
      setZombies([]);
      return;
    }

    const interval = setInterval(() => {
      frameRef.current += 1;

      // 좀비 스폰
      if (frameRef.current % SPAWN_EVERY === 0) {
        const newZombie: Zombie = {
          id: nextIdRef.current++,
          lane: Math.floor(Math.random() * 3),
          y: -ZOMBIE_H,
        };
        zombiesRef.current = [...zombiesRef.current, newZombie];
      }

      // 이동 + 화면 밖 제거
      zombiesRef.current = zombiesRef.current
        .map((z) => ({ ...z, y: z.y + ZOMBIE_SPEED }))
        .filter((z) => z.y < SCREEN_H);

      setZombies([...zombiesRef.current]);
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, [started]);

  const carLeft = lane * LANE_W + (LANE_W - CAR_W) / 2;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Road */}
      <View style={styles.road}>
        <DashedLane x={LANE_W} />
        <DashedLane x={LANE_W * 2} />

        {/* Zombies */}
        {zombies.map((z) => (
          <ZombieView key={z.id} zombie={z} />
        ))}

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
  zombie: {
    position: 'absolute',
    backgroundColor: '#2ecc40',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  zombieText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
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
