# jev-post-check

블로그 글(마크다운)을 정해 둔 체크리스트로 Jev 에게 채점받는다. [`jev-ask`](../jev-ask/) 가 `PATH` 에 있어야 한다.

```bash
ln -sf ~/dev-tools/jev-post-check/jev-post-check ~/bin/jev-post-check
jev-post-check posts/my-post.md
```

| 부분 | 질문 | 경고 기준 |
| --- | --- | --- |
| 제목 + 도입(첫 `##` 전) | 무슨 작업 중이었나 / 판돈이 있나 / 첫 문단이 제목과 같은 얘기인가 | noul < 0.5 |
| 글 전체 | "처음엔 X라고 생각했는데 아니었다" 가 있나 / 도메인을 모르는 독자가 따라오나(0~3) | noul < 0.5, score < 1.5 |
| `##` 절 제목 | 읽기 전에 무슨 절인지 보이는가(결론 압축형이 아닌가) | noul < 0.5 |

```
== sections
     heading_preview  0.79     맡긴 일의 구성이 예상과 달랐다
  !! heading_preview  0.26     나란히 보내면 실패를 늦게 안다
```

- `!!` 는 다시 볼 자리를 알려줄 뿐이다. 고칠지는 글쓴이가 정한다.
- 글 전체가 외부 API 로 나간다. **공개할 최종 원고에만** 돌린다.
- 한 편에 약 5~7천 토큰, $0.0003 안팎.

## 테스트

```bash
python3 -m unittest discover -s jev-post-check
```
