# jev-ask

여러 글에 같은 질문을 던져 TypeSafe 의 판단 모델 Jev 로 한꺼번에 채점한다.
LLM 에게 넘기기 전에 관련 없는 글을 걸러내는 1차 필터로 쓴다.

## 설치

```bash
ln -sf ~/dev-tools/jev-ask/jev-ask ~/bin/jev-ask
```

`TYPESAFE_API_KEY` 환경변수가 필요하다. 비대화형 셸에서도 읽히도록 `~/.zshenv` 에 둔다.

## 사용

```bash
echo '{
  "questions": {"hit": {"type": "noul", "instructions": "Does this text announce an upcoming concert?"}},
  "items": [{"id": "a", "state": "Tour announced, tickets open next week."},
            {"id": "b", "state": "New music video released."}]
}' | jev-ask
```

```
{"id": "a", "answers": {"hit": {"type": "noul", "noul": 0.98}}}
{"id": "b", "answers": {"hit": {"type": "noul", "noul": 0.01}}}
jev-ask: {"calls": 2, "errors": 0, "input_tokens": 587, "usd": 2.5e-05}   # stderr
```

- 질문 형식(`noul`·`choice`·`score`)은 [TypeSafe 문서](https://docs.typesafe.ai/api)를 따른다.
- 한 건이 실패해도 나머지는 계속 묻고, 실패한 건은 `{"id": ..., "error": ...}` 로 남긴다. 실패가 하나라도 있으면 종료 코드 1.
- `model` 을 생략하면 `jev-latest`.

## 주의

- `state` 는 전부 외부 API 로 나간다. 공개된 글이나 개인 데이터에만 쓴다.
- 애매한 글은 같은 입력에도 확률이 0.1 가량 흔들린다. 문턱값은 0.5 근처를 피하고, 걸러낼 때는 낮은 쪽(예: 0.2 미만만 버림)으로 잡는다.

## 테스트

```bash
python3 -m unittest discover -s jev-ask
```
