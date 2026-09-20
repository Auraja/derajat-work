import pytest

GENERATION_PATHS = ("slides", "module", "quiz", "assignment", "lesson-plan")
EXPECTED = {
    "status": "not_implemented",
    "message": "AI skill will be added later",
}


@pytest.mark.parametrize("kind", GENERATION_PATHS)
def test_generation_placeholder_has_exact_contract(auth_client, kind):
    response = auth_client.post(f"/api/v1/generation/{kind}", json={"topic": "Testing"})

    assert response.status_code == 200
    assert response.json() == EXPECTED


def test_generation_requires_authentication(client):
    response = client.post("/api/v1/generation/slides", json={"topic": "Testing"})

    assert response.status_code == 401
