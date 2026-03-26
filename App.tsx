import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const LANE_W = SCREEN_W / 3;

const CAR_W = LANE_W * 0.48;
const CAR_H = CAR_W * 1.7;
const CAR_BOTTOM = 90;

const ZOMBIE_W = LANE_W * 0.46;
const ZOMBIE_H = ZOMBIE_W * 1.2;
const FRAME_MS = 16;
const MAX_HP = 3;
const BEST_SCORE_KEY = 'DEAD_DRIVE_BEST_SCORE';

// 자동차 상단/하단 y 좌표 (화면 위 기준)
const CAR_TOP = SCREEN_H - CAR_BOTTOM - CAR_H;
const CAR_BOTTOM_Y = SCREEN_H - CAR_BOTTOM;

const DASH_HEIGHT = 22;
const DASH_GAP = 22;
const DASH_COUNT = Math.ceil(SCREEN_H / (DASH_HEIGHT + DASH_GAP));

// ── 난이도 계산 (10초 단위로 레벨 상승) ──
const LEVEL_UP_SECONDS = 10;

function getLevel(seconds: number): number {
  return Math.floor(seconds / LEVEL_UP_SECONDS) + 1;
}

function getZombieSpeed(level: number): number {
  // 기본 4, 레벨마다 +1, 최대 10
  return Math.min(4 + (level - 1), 10);
}

function getSpawnEvery(level: number): number {
  // 기본 90프레임, 레벨마다 -10, 최소 30프레임
  return Math.max(90 - (level - 1) * 10, 30);
}

type Zombie = {
  id: number;
  lane: number; // 0 | 1 | 2
  y: number;    // top (px, 화면 위쪽 기준)
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
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [bestScore, setBestScore] = useState(0);

  const zombiesRef = useRef<Zombie[]>([]);
  const frameRef = useRef(0);
  const nextIdRef = useRef(0);
  const laneRef = useRef(1);
  const hpRef = useRef(MAX_HP);
  const gameOverRef = useRef(false);
  const bestScoreRef = useRef(0);

  // 앱 시작 시 최고 점수 로드
  useEffect(() => {
    AsyncStorage.getItem(BEST_SCORE_KEY).then((val) => {
      if (val !== null) {
        const saved = parseInt(val, 10);
        bestScoreRef.current = saved;
        setBestScore(saved);
      }
    });
  }, []);

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

  // 최고 점수 저장
  const saveBestScore = (newScore: number) => {
    if (newScore > bestScoreRef.current) {
      bestScoreRef.current = newScore;
      setBestScore(newScore);
      AsyncStorage.setItem(BEST_SCORE_KEY, String(newScore));
    }
  };

  // ── 게임 루프 ──
  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      frameRef.current += 1;
      const currentFrame = frameRef.current;

      // 점수 = 생존 시간(초)
      const currentScore = Math.floor(currentFrame / 60);
      const currentLevel = getLevel(currentScore);
      const zombieSpeed = getZombieSpeed(currentLevel);
      const spawnEvery = getSpawnEvery(currentLevel);

      // 좀비 스폰
      if (currentFrame % spawnEvery === 0) {
        const newZombie: Zombie = {
          id: nextIdRef.current++,
          lane: Math.floor(Math.random() * 3),
          y: -ZOMBIE_H,
        };
        zombiesRef.current = [...zombiesRef.current, newZombie];
      }

      // 이동
      zombiesRef.current = zombiesRef.current.map((z) => ({
        ...z,
        y: z.y + zombieSpeed,
      }));

      // 충돌 판정
      let currentHp = hpRef.current;
      const surviving: Zombie[] = [];

      for (const z of zombiesRef.current) {
        if (z.y >= SCREEN_H) continue; // 화면 밖 제거

        const sameLane = z.lane === laneRef.current;
        const yOverlap = z.y < CAR_BOTTOM_Y && z.y + ZOMBIE_H > CAR_TOP;

        if (sameLane && yOverlap) {
          currentHp -= 1;
        } else {
          surviving.push(z);
        }
      }

      zombiesRef.current = surviving;
      hpRef.current = currentHp;
      setZombies([...surviving]);
      setHp(currentHp);
      setScore(currentScore);
      setLevel(currentLevel);

      if (currentHp <= 0) {
        gameOverRef.current = true;
        saveBestScore(currentScore);
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
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setStarted(true);
  };

  const carLeft = lane * LANE_W + (LANE_W - CAR_W) / 2;
  // 현재 점수가 최고 점수인지 (게임오버 시점)
  const isNewBest = score > 0 && score >= bestScore;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Road */}
      <View style={styles.road}>
        <DashedLane x={LANE_W} />
        <DashedLane x={LANE_W * 2} />

        {zombies.map((z) => (
          <ZombieView key={z.id} zombie={z} />
        ))}

        {/* Car */}
        <View style={[styles.car, { left: carLeft, bottom: CAR_BOTTOM }]}>
          <View style={styles.carRoof} />
          <View style={styles.carBody} />
        </View>
      </View>

      {/* HUD (플레이 중) */}
      {started && !gameOver && (
        <View style={styles.hud}>
          <Text style={styles.hudScore}>{score}s</Text>
          <Text style={styles.hudHp}>
            {Array.from({ length: MAX_HP }).map((_, i) =>
              i < hp ? '♥' : '♡'
            ).join(' ')}
          </Text>
          <Text style={styles.hudLevel}>Lv.{level}</Text>
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
          {bestScore > 0 && (
            <Text style={styles.overlayBest}>BEST  {bestScore}s</Text>
          )}
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
          <Text style={styles.finalScore}>{score}s</Text>
          {isNewBest && (
            <Text style={styles.newBestText}>NEW BEST!</Text>
          )}
          <Text style={styles.overlayBest}>BEST  {bestScore}s</Text>
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
  // HUD (점수 / HP / 레벨)
  hud: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  hudScore: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    minWidth: 60,
  },
  hudHp: {
    fontSize: 26,
    color: '#ff4444',
    letterSpacing: 4,
  },
  hudLevel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffdd00',
    minWidth: 60,
    textAlign: 'right',
  },
  // 오버레이 공통
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
    marginBottom: 16,
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff2222',
    letterSpacing: 4,
    marginBottom: 12,
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  finalScore: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  newBestText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffdd00',
    letterSpacing: 4,
    marginBottom: 6,
  },
  overlayBest: {
    fontSize: 18,
    color: '#aaaaaa',
    letterSpacing: 2,
    marginBottom: 48,
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
