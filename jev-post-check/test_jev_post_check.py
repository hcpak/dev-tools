"""Tests for jev-post-check. Run: python3 -m unittest discover -s jev-post-check"""
import importlib.machinery
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
_loader = importlib.machinery.SourceFileLoader(
    "jev_post_check", os.path.join(HERE, "jev-post-check"))
_spec = importlib.util.spec_from_loader("jev_post_check", _loader)
mod = importlib.util.module_from_spec(_spec)
_loader.exec_module(mod)

POST = """# Title here

First intro paragraph.

Second intro paragraph.

---

## Section one

Body one.

```
## not a heading inside a fence
```

### Sub heading stays in section one

More body.

## Section two

Body two.
"""


class ParsePostTest(unittest.TestCase):
    def test_title_intro_and_level2_sections(self):
        post = mod.parse_post(POST)
        self.assertEqual(post["title"], "Title here")
        self.assertEqual(post["intro"], "First intro paragraph.\n\nSecond intro paragraph.")
        self.assertEqual([s["heading"] for s in post["sections"]],
                         ["Section one", "Section two"])

    def test_fenced_hash_lines_and_subheadings_stay_in_body(self):
        body = mod.parse_post(POST)["sections"][0]["body"]
        self.assertIn("## not a heading inside a fence", body)
        self.assertIn("### Sub heading stays in section one", body)


class BuildRequestsTest(unittest.TestCase):
    def test_three_requests_intro_whole_and_sections(self):
        reqs = mod.build_requests(mod.parse_post(POST), POST)
        self.assertEqual([r["name"] for r in reqs], ["intro", "whole", "sections"])
        intro = reqs[0]["request"]
        self.assertEqual(intro["items"], [{
            "id": "intro",
            "state": "Title: Title here\n\nFirst intro paragraph.\n\nSecond intro paragraph."}])
        self.assertEqual(reqs[1]["request"]["items"][0]["state"], POST)
        self.assertEqual([i["state"] for i in reqs[2]["request"]["items"]],
                         ["Section one", "Section two"])


class FlagTest(unittest.TestCase):
    def test_low_noul_and_low_score_are_flagged(self):
        self.assertTrue(mod.is_flagged({"type": "noul", "noul": 0.3}))
        self.assertFalse(mod.is_flagged({"type": "noul", "noul": 0.8}))
        self.assertTrue(mod.is_flagged({"type": "score", "score": 1.2}))
        self.assertFalse(mod.is_flagged({"type": "score", "score": 2.1}))


if __name__ == "__main__":
    unittest.main()
