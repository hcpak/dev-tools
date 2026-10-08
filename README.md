# dev-tools

직접 만들어 쓰는 개발 도구 모음. 필요해서 만든 것만 있고, 쓰면서 계속 고친다.

## 도구

| 도구 | 하는 일 |
| --- | --- |
| [claude-context-panel](claude-context-panel/) | Claude Code 세션의 할 일·참조 링크·산출물 파일을 터미널 한쪽에 실시간으로 띄운다 |
| [md-heading-anchors](md-heading-anchors/) | 기준 마크다운의 헤딩 앵커를 변형본 파일들에 순서대로 이식한다 |
| [chrome-bg-tab](chrome-bg-tab/) | Chrome 에 새 탭을 화면을 뺏지 않고 열고, 그 탭의 id 를 출력한다 |

## 설치 방식

각 도구 디렉토리의 README를 따른다. 공통적으로 **저장소를 클론한 뒤 `~/bin` 에 심볼릭 링크를 거는** 방식을 쓴다.

```bash
git clone https://github.com/hcpak/dev-tools.git ~/dev-tools
for f in context-panel context-panel-split context-panel-ensure context-panel-link context-add; do
  ln -sf ~/dev-tools/claude-context-panel/$f ~/bin/$f
done
```

사본을 복사해두면 반드시 갈라진다 — 급할 때 `~/bin` 쪽만 고치고 저장소에는 안 올리게 되기 때문이다.
링크를 걸어두면 저장소에서 고친 게 곧바로 동작에 반영된다.

## 라이선스

MIT
