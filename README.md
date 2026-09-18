# 이심전심 감정탐정 2.0

기존 캐치마인드형 앱을 `상황 → 친구 감정 추리 → 나의 감정 선택 → 학급 감정 분포` 구조로 바꾼 Socket.IO 웹앱입니다.

## 포함 기능

- 20개 감정 × 3개 상황(총 60개)
- 라운드별 말·이모지·행동/대사·그림·자유표현 미션
- 추리 감정 6개와 판단 근거 선택
- 같은 상황에서 내가 느낄 감정 최대 2개 선택
- 학급 감정 분포와 공동 성찰 화면
- 서버 기준 타이머·점수·라운드 관리
- 브라우저 새로고침/일시적 연결 끊김 후 자동 복귀
- 화면을 넓게 쓰는 반응형 그림판

## 로컬 실행

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 기존 GitHub 저장소에 적용

1. 기존 저장소를 별도 브랜치로 백업합니다.
2. 이 폴더의 `server.js`, `package.json`, `public/`을 저장소 루트에 복사합니다.
3. 기존 앱의 서버 코드가 따로 있다면 통째로 섞지 말고, 먼저 이 버전을 독립 브랜치에서 실행해 확인합니다.
4. 아래 명령으로 반영합니다.

```bash
git checkout -b emotion-detective-2
git add server.js package.json public README.md
git commit -m "Upgrade to Emotion Detective 2.0"
git push -u origin emotion-detective-2
```

정상 작동을 확인한 뒤 GitHub에서 기본 브랜치로 병합합니다.

## Render 배포 설정

기존 Render Web Service에서 다음만 확인합니다.

- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/`
- Auto-Deploy: 켬(기본 브랜치 배포 시)

`PORT`는 Render가 자동으로 제공합니다. 별도 환경변수는 필요 없습니다. GitHub 브랜치만 먼저 시험하려면 Render 서비스의 배포 브랜치를 잠시 `emotion-detective-2`로 바꾸거나, 별도의 테스트 Web Service를 만든 뒤 확인하세요.

## 수업 전 점검

- 교사용 기기 1대와 학생 기기 2대 이상으로 접속
- 학생 기기에서 새로고침 후 같은 방으로 복귀되는지 확인
- 휴대전화 그림 라운드에서 스크롤 대신 선이 그어지는지 확인
- Render 무료 인스턴스를 사용한다면 수업 5~10분 전에 한 번 접속해 깨우기

> 현재 방 상태는 서버 메모리에 저장됩니다. Render가 재시작되면 진행 중인 방은 사라집니다. 수업 중 서버 재시작까지 견디게 하려면 Redis 같은 외부 저장소를 추가해야 합니다.
