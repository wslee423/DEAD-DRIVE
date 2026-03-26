# DEAD DRIVE

좀비 떼를 피해 최대한 오래 살아남는 모바일 생존 게임.

## 실행 (개발)

```bash
npm install
npx expo start
```

Expo Go 앱으로 QR 코드를 스캔하거나, `a` 키로 Android 에뮬레이터에서 실행하세요.

## 안드로이드 테스트 빌드 (APK)

```bash
# EAS CLI 설치 (최초 1회)
npm install -g eas-cli

# Expo 로그인
eas login

# 프리뷰 APK 빌드 (기기 직접 설치용)
eas build -p android --profile preview
```

빌드 완료 후 Expo 대시보드에서 APK를 다운로드해 기기에 직접 설치할 수 있습니다.

### eas.json (없으면 생성)

```bash
eas build:configure
```

또는 `eas.json`을 아래 내용으로 직접 생성:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

## 조작

| 입력 | 동작 |
|------|------|
| 화면 왼쪽 탭 | 차선 왼쪽 이동 |
| 화면 오른쪽 탭 | 차선 오른쪽 이동 |

## 게임 규칙

- 생존 시간(초)이 점수
- 좀비에 충돌하면 HP -1, HP 0이면 게임오버
- 10초마다 레벨 상승 → 좀비 속도 증가, 스폰 간격 단축
