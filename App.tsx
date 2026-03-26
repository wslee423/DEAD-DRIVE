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

const MAX_HP = 3;

// 자동차 상단/하단 y 좌표 (화면 위 기준)
const CAR_TOP = SCREEN_H - CAR_BOTTOM - CAR_H;
const CAR_BOTTOM_Y = SCREEN_H - CAR_BOTTOM;

const DASH_HEIGHT = 22;
const DASH_GAP = 22;
const DASH_COUNT = Math.ceil(SCREEN_H / (DASH_HEIGHT + DASH_GAP));

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
  const [gameOver, setGameOver] = useState(false);
  const [lane, setLane] = useState(1); // 0 = left, 1 = center, 2 = right
  const [zombies, setZombies] = useState<Zombie[]>([]);
  const [hp, setHp] = useState(MAX_HP);

  const zombiesRef = useRef<Zombie[]>([]);
  const frameRef = useRef(0);
  const nextIdRef = useRef(0);
  const laneRef = useRef(1);
  const hpRef = useRef(MAX_HP);
  const gameOverRef = useRef(false);

  // lane 변경 시 ref 동기화
  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  const moveLeft = () => setLane((prev) => {
    const next = Math.max(0, prev - 1);
    laneRef.current = next;
    return next;
  });
  const moveRight = () => setLane((prev) => {
    const next = Math.min(2, prev + 1);
    laneRef.current = next;
    return next;
  });

  // ── 게임 루프 ──
  useEffect(() => {
    if (!started || gameOver) {
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

      // 이동
      zombiesRef.current = zombiesRef.current.map((z) => ({ ...z, y: z.y + ZOMBIE_SPEED }));

      // 충돌 판정
      let currentHp = hpRef.current;
      const surviving: Zombie[] = [];

      for (const z of zombiesRef.current) {
        const isOffScreen = z.y >= SCREEN_H;
        if (isOffScreen) continue; // 화면 밖 제거

        const sameLane = z.lane === laneRef.current;
        const yOverlap = z.y < CAR_BOTTOM_Y && z.y + ZOMBIE_H > CAR_TOP;

        if (sameLane && yOverlap) {
          // 충돌: 좀비 제거 + 체력 감소
          currentHp -= 1;
        } else {
          surviving.push(z);
        }
      }

      zombiesRef.current = surviving;
      hpRef.current = currentHp;
      setZombies([...surviving]);
      setHp(currentHp);

      if (currentHp <= 0) {
        gameOverRef.current = true;
        setGameOver(true);
        clearInterval(interval);
      }
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, [started, gameOver]);

  // ── Restart ──
  const handleRestart = () => {
    zombiesRef.current = [];
    frameRef.current = 0;
    nextIdRef.current = 0;
    hpRef.current = MAX_HP;
    gameOverRef.current = false;
    laneRef.current = 1;

    setZombies([]);
    setHp(MAX_HP);
    setLane(1);
    setGameOver(false);
    setStarted(true);
  };

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

      {/* HP 표시 */}
      {started && !gameOver && (
        <View style={styles.hpBar}>
          <Text style={styles.hpText}>
            {Array.from({ length: MAX_HP }).map((_, i) => (i < hp ? '♥' : '♡')).join(' ')}
          </Text>
        </View>
      )}

      {/* Tap zones */}
      {started && !gameOver && (
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
      {!started && !gameOver && (
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

      {/* Game Over overlay */}
      {gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <TouchableOpacity style={styles.startBtn} onPress={handleRestart}>
            <Text style={styles.startBtnText}>RESTART</Text>
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
  hpBar: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hpText: {
    fontSize: 30,
    color: '#ff4444',
    letterSpacing: 4,
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
  gameOverText: {
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
