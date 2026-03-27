import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const LANE_W = SCREEN_W / 3;

const CAR_W = LANE_W * 0.74;
const CAR_H = CAR_W * 1.8;
const CAR_BOTTOM = 90;

const ZOMBIE_W = LANE_W * 0.70;
const ZOMBIE_H = ZOMBIE_W * 1.4;
const FRAME_MS = 16;
const MAX_HP = 3;
const BEST_SCORE_KEY = 'DEAD_DRIVE_BEST_SCORE';

// 자동차 상단/하단 y 좌표 (화면 위 기준)
const CAR_TOP = SCREEN_H - CAR_BOTTOM - CAR_H;
const CAR_BOTTOM_Y = SCREEN_H - CAR_BOTTOM;

// 도로 스크롤 상수
const DASH_H = 30;
const DASH_GAP = 18;
const DASH_CYCLE = DASH_H + DASH_GAP;
const DASH_COUNT = Math.ceil(SCREEN_H / DASH_CYCLE) + 3;

// 난이도 계산 (10초 단위로 레벨 상승)
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

// ── 스크롤 차선 분리선 ──
function ScrollingLanes({ scrollY }: { scrollY: Animated.Value }) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -DASH_CYCLE,
        height: SCREEN_H + DASH_CYCLE * 2,
        transform: [{ translateY: scrollY }],
      }}
    >
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <React.Fragment key={i}>
          <View style={[styles.dashMark, { left: LANE_W - 1.5, top: i * DASH_CYCLE }]} />
          <View style={[styles.dashMark, { left: LANE_W * 2 - 1.5, top: i * DASH_CYCLE }]} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ── 좀비 컴포넌트 ──
function ZombieView({ zombie }: { zombie: Zombie }) {
  const left = zombie.lane * LANE_W + (LANE_W - ZOMBIE_W) / 2;
  return (
    <View style={{ position: 'absolute', left, top: zombie.y, width: ZOMBIE_W, height: ZOMBIE_H }}>
      <Image
        source={require('./assets/images/zombie.png')}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </View>
  );
}

// ── 자동차 컴포넌트 ──
function CarView({ carLeft }: { carLeft: number }) {
  return (
    <View style={{ position: 'absolute', left: carLeft, bottom: CAR_BOTTOM, width: CAR_W, height: CAR_H }}>
      <Image
        source={require('./assets/images/car.png')}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
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
  const roadScrollAnim = useRef(new Animated.Value(0)).current;

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

  // 도로 스크롤 애니메이션 (게임오버 아닐 때 항상 실행)
  useEffect(() => {
    if (gameOver) return;

    const anim = Animated.loop(
      Animated.timing(roadScrollAnim, {
        toValue: DASH_CYCLE,
        duration: 180,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [gameOver]);

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
    roadScrollAnim.setValue(0);
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
  const isNewBest = score > 0 && score >= bestScore;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* 도로 배경 */}
      <ImageBackground
        source={require('./assets/images/road.png')}
        style={styles.road}
        resizeMode="cover"
      />

      {/* 스크롤 차선 */}
      <ScrollingLanes scrollY={roadScrollAnim} />

      {/* 도로 가장자리 선 */}
      <View style={styles.roadEdgeLeft} />
      <View style={styles.roadEdgeRight} />

      {/* 좀비 */}
      {zombies.map((z) => (
        <ZombieView key={z.id} zombie={z} />
      ))}

      {/* 자동차 */}
      <CarView carLeft={carLeft} />

      {/* HUD (플레이 중) */}
      {started && !gameOver && (
        <View style={styles.hud}>
          <View style={styles.hudBg}>
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>TIME</Text>
              <Text style={styles.hudValue}>{score}s</Text>
            </View>
            <View style={styles.hudHpBox}>
              {Array.from({ length: MAX_HP }).map((_, i) => (
                <Text key={i} style={i < hp ? styles.hudHeartFull : styles.hudHeartEmpty}>♥</Text>
              ))}
            </View>
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>LV</Text>
              <Text style={styles.hudValueYellow}>{level}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 탭 조작 영역 */}
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

      {/* 시작 화면 */}
      {!started && !gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.title}>DEAD DRIVE</Text>
          <Text style={styles.subtitle}>SURVIVE THE HORDE</Text>
          {bestScore > 0 && (
            <Text style={styles.overlayBest}>BEST  {bestScore}s</Text>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setStarted(true)}
          >
            <Text style={styles.actionBtnText}>START</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 게임오버 화면 */}
      {gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <Text style={styles.finalScore}>{score}s</Text>
          {isNewBest && (
            <Text style={styles.newBestText}>★  NEW BEST  ★</Text>
          )}
          <Text style={styles.overlayBest}>BEST  {bestScore}s</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={handleRestart}>
            <Text style={styles.actionBtnText}>RESTART</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  road: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1c1c1e',
  },
  roadEdgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 3,
    width: 3,
    backgroundColor: '#ccaa00',
    opacity: 0.55,
  },
  roadEdgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 3,
    width: 3,
    backgroundColor: '#ccaa00',
    opacity: 0.55,
  },
  dashMark: {
    position: 'absolute',
    width: 3,
    height: DASH_H,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1.5,
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_W / 2,
  },
  // HUD
  hud: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  hudBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hudItem: {
    alignItems: 'center',
    minWidth: 52,
  },
  hudLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
  },
  hudValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 28,
  },
  hudValueYellow: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffdd00',
    lineHeight: 28,
  },
  hudHpBox: {
    flexDirection: 'row',
    gap: 6,
  },
  hudHeartFull: {
    fontSize: 24,
    color: '#ff3333',
    lineHeight: 30,
  },
  hudHeartEmpty: {
    fontSize: 24,
    color: 'rgba(255,80,80,0.25)',
    lineHeight: 30,
  },
  // 오버레이 공통
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ff2222',
    letterSpacing: 5,
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 4,
    marginBottom: 36,
  },
  gameOverText: {
    fontSize: 46,
    fontWeight: '900',
    color: '#ff2222',
    letterSpacing: 4,
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 10,
  },
  finalScore: {
    fontSize: 60,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textShadowColor: 'rgba(255,255,255,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  newBestText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffdd00',
    letterSpacing: 3,
    marginBottom: 6,
    textShadowColor: '#ffcc00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  overlayBest: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 3,
    marginBottom: 48,
  },
  actionBtn: {
    backgroundColor: '#bb0000',
    paddingHorizontal: 52,
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ff4444',
    elevation: 10,
    shadowColor: '#ff0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
  },
});
