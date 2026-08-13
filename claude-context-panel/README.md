# claude-context-panel

Claude Code 세션의 **할 일 · 참조 링크 · 산출물 파일**을 터미널 한쪽에 실시간으로 띄우는 패널.

세션이 길어지면 앞에서 정한 것들이 스크롤 위로 밀려 올라간다. 아까 받은 링크, 지금 손대는 파일이
대화 어딘가에 있긴 한데 찾으려면 한참 올려야 한다. 세션을 여러 개 띄우면 그게 세션 수만큼 늘어난다.
이 패널은 그 둘만 뽑아 아래쪽 몇 줄에 고정해둔다.

할 일은 **직접 적은 것만** 다룬다. Claude Code 의 세션 태스크는 읽지 않는다 — 그쪽은 자체 요약이
터미널에 뜨므로 중복이다. 대신 배포 반영 확인처럼 **다음 세션까지 남아야 하는 것**을 여기 적어둔다.

```
CONTEXT  할 일 2  핀 3 · 파일 2 · a3f21c8e · 17:33:09
── 할 일 ─────────────────────────────────────────
☐ 배포 반영 확인 — 8/18 까지 안 들어가면 재검증 불가
☐ 값 체계 결정 — 문서 담당 협의 선행
── 핀 ────────────────────────────────────────────
▸ #1114 로거가 트래픽 방향을 반대로 기록함   https://tracker.example.com/tasks/1114
▸ #1120 캐시가 안 갱신돼 값이 어긋남         https://tracker.example.com/tasks/1120
▸ 초안 #1114 회신 댓글   /tmp/scratch/draft-1114-comment.md
── 파일 ──────────────────────────────────────────
✎ collector/receiver.py
✎ tests/test_receiver.py
```

링크와 파일은 **`Cmd`(또는 `Ctrl`) + 클릭으로 바로 열린다.** OSC 8 하이퍼링크라 화면에는 짧은 이름만
보이고 전체 경로는 링크에 숨어 있어서, 패널이 좁아도 레이아웃이 깨지지 않는다.

## 요구 사항

- Python 3.7+ (표준 라이브러리만 사용)
- Claude Code — 세션 디렉토리(`~/.claude/tasks/`)와 트랜스크립트(`~/.claude/projects/`)를 읽는다
- 링크 클릭은 OSC 8을 지원하는 터미널에서 동작한다. 미지원 터미널에서도 화면은 정상이고 클릭만 안 된다

## 설치

```bash
git clone https://github.com/hcpak/dev-tools.git ~/dev-tools
mkdir -p ~/bin
for f in context-panel context-panel-split context-panel-link context-add; do
  ln -sf ~/dev-tools/claude-context-panel/$f ~/bin/$f
done
```

`~/bin` 이 `PATH` 에 없다면 추가한다.

## 사용법

### 패널 띄우기

```bash
context-panel                  # 이 터미널 탭의 현재 세션을 따라간다
context-panel --session <id>   # 특정 세션에 고정 (id 앞부분만 써도 된다)
context-panel --once           # 한 번만 출력하고 종료
context-panel -i 3             # 갱신 주기(초), 기본 5
```

스크립트를 고치면 **실행 중인 패널이 스스로 재시작한다.** 다시 띄울 필요가 없다.

### 링크·메모 꽂기

```bash
context-add "#1114 로거 방향 오분류  https://tracker.example.com/tasks/1114"
context-add --add  "초안  /tmp/scratch/draft.md"
context-add --todo "배포 반영 확인 — 8/18 까지"
context-add --clear
```

`--todo` 는 `할 일` 칸에 `☐` 로, 나머지는 `핀` 칸에 `▸` 로 붙는다.
(내부적으로는 줄 앞에 `todo:` 를 붙여 구분한다 — `.panel-context` 를 직접 편집할 때도 같다.) URL은 폭이 모자라도 **잘리지 않는다** — 대신 설명을 버린다.
링크 끝이 한 글자만 날아가도 다른 페이지로 가버리기 때문이다.

### 파일

세션에서 **만들어낸 파일**만 올라온다. 읽기만 한 파일, 임시 파일, 도구 자신이 쓰는 파일은 뺀다.
판별 기준은 이렇다.

| 거르는 것 | 방법 |
| --- | --- |
| 홈 밖 · 임시 디렉토리 | 홈 아래 경로만 수집 |
| 어시스턴트 내부 파일 | `~/.claude/`, `~/bin/` 제외 |
| 저장소 부속 파일 | `README.md`, `LICENSE`, `CHANGELOG.md`, `.gitignore` 제외 |
| 읽기만 한 파일 | 파일을 만드는 것처럼 보이는 명령에서만 경로를 줍는다 |

오늘 만든 것이 먼저 자리를 잡고, 남는 자리에 이전 것이 들어간다. 세션이 자정을 넘겨도
어제 작업이 오늘 작업을 밀어내지 않는다.

⚠️ **셸로 파일을 만들 때는 절대 경로를 쓰는 편이 좋다.** 상대 경로는 인식하지 못한다.
`--screenshot=out.png` 처럼 적으면 안 잡히고 `--screenshot=$PWD/out.png` 는 잡힌다.

## 설정

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONTEXT_PANEL_PIN_LABEL` | `핀` | 첫 칸 제목. 쓰는 이슈 트래커 이름 등으로 바꾼다 |
| `CONTEXT_PANEL_UTC_OFFSET` | `9` | "오늘" 판정에 쓰는 시간대 offset |

## 터미널 분할해서 띄우기 (선택)

`context-panel-split` 은 [Orca](https://orca.computer) 터미널에서 현재 pane 을 나눠 아래쪽에 패널을 띄운다.

```bash
context-panel-split
```

다른 터미널을 쓴다면 이 스크립트 대신 **직접 창을 나눈 뒤 `context-panel` 을 실행**하면 된다.
패널 본체는 특정 터미널에 의존하지 않는다.

### 탭이 세션을 따라가게 하기 (선택)

`context-panel-link` 를 Claude Code 의 SessionStart 훅에 걸어두면, 같은 탭에서 새 세션을 시작해도
패널이 알아서 갈아탄다. `~/.claude/settings.json` 에 추가한다.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "~/bin/context-panel-link" }] }
    ]
  }
}
```

## 잘 안 될 때

**항목이 하나도 안 보인다**

원인이 셋이라 순서대로 본다.

1. `ls ~/.claude/tasks/<세션>/` — `*.json` 이 없고 `.highwatermark` 만 있으면 **다 완료한 것이다.** 고장이 아니다
2. 파일은 있는데 안 보이면 세션 ID가 어긋난 것이다. `context-panel --session <현재 세션 id>` 로 확인해본다
3. 그래도 비어 있으면 `context-panel --once` 로 렌더링 자체를 확인한다

**링크를 눌렀는데 다른 페이지가 열린다**

패널 폭이 너무 좁아 URL이 잘렸을 때 생기던 문제로, 지금은 그런 경우 설명을 버리고 URL을 남긴다.
그래도 발생하면 pane 을 조금 넓혀본다.

## 라이선스

MIT
