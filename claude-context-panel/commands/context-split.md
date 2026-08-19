---
description: 지금 탭 아래쪽에 컨텍스트 패널을 붙인다 (탭 이동 없음)
allowed-tools: Bash(~/bin/context-panel-split)
---

`~/bin/context-panel-split` 을 실행해서 현재 pane 을 분할하고 아래쪽 pane 에 컨텍스트 패널을 띄워라.
Orca 에는 위쪽 분할이 없으므로 패널은 아래에 생긴다. 이 방식은 탭 제목을 건드리지 않으므로 탭에는 Claude 세션 이름이 그대로 표시된다.

패널에는 핀(`~/bin/context-add` 로 기록한 링크·파일 경로)과 이 세션에서 만든 산출물 파일이 표시된다.
세션 태스크(TaskCreate)는 하네스가 자체 요약을 띄우므로 패널에서는 다루지 않는다.
