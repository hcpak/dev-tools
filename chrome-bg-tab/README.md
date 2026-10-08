# chrome-bg-tab

Chrome 에 새 탭을 **화면을 뺏지 않고** 열고, 그 탭의 id 를 출력한다.

에이전트가 Chrome 을 AppleScript 로 다루면서 사람도 같은 Chrome 을 쓰고 있으면, 새 탭을 여는 순간이 가장
방해가 된다. `open location` 은 Chrome 을 앞으로 끌어오고 새 탭을 보이는 탭으로 바꾼다. 쓰던 앱에서 Chrome
으로 화면이 넘어가고, Chrome 안에서도 보던 페이지가 사라진다.

## 하는 일

1. 앞 창의 맨 끝에 탭을 붙인다.
2. 그 창의 활성 탭을 원래대로 되돌린다.
3. Chrome 을 activate 하지 않는다. 쓰던 앱이 앞에 그대로 남는다.

출력된 id 로 그 탭만 골라 `execute javascript` 를 돌리면, 사람이 보는 탭과 에이전트가 쓰는 탭이 섞이지 않는다.

## 사용

```bash
chrome-bg-tab https://example.com
```

출력 예: `1495655848`

## 함정 (실측)

- **뒤쪽 창에 탭을 붙이면 그 창이 Chrome 안에서 맨 앞으로 올라온다.** 앱은 activate 되지 않지만, 다음에
  Chrome 으로 돌아갔을 때 다른 창이 위에 있다.
- **그 창 순서를 `set index of window … to 1` 로 되돌리면 Chrome 앱 자체가 activate 된다.** 그래서 앞 창에
  붙이는 방식만 남겼다.
- `repeat with t in tabs` 안의 `id of t is N` 비교는 조용히 실패할 때가 있다. 특정 탭을 닫거나 고를 때는
  `tab id N of window id M` 처럼 직접 참조한다.

## 설치

```bash
ln -sf ~/dev-tools/chrome-bg-tab/chrome-bg-tab ~/bin/chrome-bg-tab
```

macOS 와 Google Chrome 이 필요하다. 처음 실행하면 터미널이 Chrome 을 제어하는 권한(자동화)을 묻는다.
