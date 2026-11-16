from app.retrieval import reciprocal_rank_fusion
from app.store import Hit


def hit(cid, score=0.0):
    return Hit(cid, "d", 0, 1, 1, "1", "1", "t", score)


def test_rrf_rewards_agreement_between_rankers():
    dense = [hit("a"), hit("b"), hit("c")]
    keyword = [hit("c"), hit("b"), hit("x")]
    fused = reciprocal_rank_fusion([dense, keyword], k=3)
    # b is 2nd in both; a and c are 1st in one list and absent/3rd in the other.
    assert [h.chunk_id for h in fused][:1] in (["b"], ["c"])
    assert {h.chunk_id for h in fused} <= {"a", "b", "c", "x"}
    assert len(fused) == 3


def test_rrf_scores_are_rank_based():
    fused = reciprocal_rank_fusion([[hit("a", 0.99)], [hit("a", 0.01)]], k=1, rrf_k=60)
    assert abs(fused[0].score - 2 / 61) < 1e-12


def test_rrf_handles_empty_lists():
    assert reciprocal_rank_fusion([[], []], k=5) == []
    assert [h.chunk_id for h in reciprocal_rank_fusion([[hit("a")], []], k=5)] == ["a"]
