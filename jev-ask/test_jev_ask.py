"""Tests for jev-ask. Run: python3 -m unittest discover -s jev-ask"""
import importlib.machinery
import importlib.util
import io
import json
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
_loader = importlib.machinery.SourceFileLoader("jev_ask", os.path.join(HERE, "jev-ask"))
_spec = importlib.util.spec_from_loader("jev_ask", _loader)
jev_ask = importlib.util.module_from_spec(_spec)
_loader.exec_module(jev_ask)

QUESTIONS = {"hit": {"type": "noul", "instructions": "Is this a concert announcement?"}}


def fake_response(noul, tokens=100):
    return {"model": "jev-1.13.0",
            "answers": {"hit": {"type": "noul", "noul": noul}},
            "usage": {"input_tokens": tokens, "output_tokens": 10}}


class BuildPayloadTest(unittest.TestCase):
    def test_payload_carries_state_questions_and_model(self):
        payload = jev_ask.build_payload("some text", QUESTIONS, "jev-latest")
        self.assertEqual(payload, {"state": "some text", "model": "jev-latest",
                                   "questions": QUESTIONS})


class ParseRequestTest(unittest.TestCase):
    def test_reads_items_and_questions(self):
        req = jev_ask.parse_request(json.dumps(
            {"questions": QUESTIONS, "items": [{"id": "a", "state": "x"}]}))
        self.assertEqual(req["items"], [{"id": "a", "state": "x"}])
        self.assertEqual(req["model"], jev_ask.DEFAULT_MODEL)

    def test_missing_questions_is_an_error(self):
        with self.assertRaises(ValueError):
            jev_ask.parse_request(json.dumps({"items": [{"id": "a", "state": "x"}]}))

    def test_item_without_id_or_state_is_an_error(self):
        with self.assertRaises(ValueError):
            jev_ask.parse_request(json.dumps(
                {"questions": QUESTIONS, "items": [{"state": "x"}]}))


class RunTest(unittest.TestCase):
    def test_one_result_per_item_in_input_order(self):
        calls = []

        def caller(payload):
            calls.append(payload["state"])
            return fake_response(0.9 if payload["state"] == "yes" else 0.1)

        out = io.StringIO()
        total = jev_ask.run({"questions": QUESTIONS, "model": "m",
                             "items": [{"id": "1", "state": "yes"},
                                       {"id": "2", "state": "no"}]}, caller, out)
        rows = [json.loads(line) for line in out.getvalue().splitlines()]
        self.assertEqual(calls, ["yes", "no"])
        self.assertEqual([r["id"] for r in rows], ["1", "2"])
        self.assertEqual(rows[0]["answers"]["hit"]["noul"], 0.9)
        self.assertEqual(total, {"calls": 2, "errors": 0, "input_tokens": 200})

    def test_failed_item_is_reported_and_others_still_run(self):
        def caller(payload):
            if payload["state"] == "bad":
                raise RuntimeError("HTTP 500")
            return fake_response(0.5)

        out = io.StringIO()
        total = jev_ask.run({"questions": QUESTIONS, "model": "m",
                             "items": [{"id": "1", "state": "bad"},
                                       {"id": "2", "state": "ok"}]}, caller, out)
        rows = [json.loads(line) for line in out.getvalue().splitlines()]
        self.assertEqual(rows[0], {"id": "1", "error": "HTTP 500"})
        self.assertIn("answers", rows[1])
        self.assertEqual(total["errors"], 1)


if __name__ == "__main__":
    unittest.main()
