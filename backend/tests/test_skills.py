from sqlalchemy import select

from app.models import Workspace


def _workspace_id(app, slug: str = "bisa-ai") -> int:
    with app.state.session_factory() as session:
        return session.scalar(select(Workspace.id).where(Workspace.slug == slug))


def _create_skill(auth_client, workspace_id: int, name: str = "Riset Ringkas") -> dict:
    response = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/skills",
        json={
            "name": name,
            "description": "Merangkum sumber menjadi catatan keputusan.",
            "instructions": "Baca sumber, catat bukti, lalu simpulkan secara ringkas.",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_skill_crud_is_scoped_to_workspace(app, auth_client):
    workspace_id = _workspace_id(app)
    created = _create_skill(auth_client, workspace_id)

    assert created["slug"] == "riset-ringkas"
    assert created["workspace_id"] == workspace_id
    listed = auth_client.get(f"/api/v1/workspaces/{workspace_id}/skills")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [created["id"]]

    updated = auth_client.patch(
        f"/api/v1/skills/{created['id']}",
        json={"name": "Riset Terarah", "slug": "riset-terarah", "is_enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Riset Terarah"
    assert updated.json()["is_enabled"] is False

    assert auth_client.delete(f"/api/v1/skills/{created['id']}").status_code == 204
    assert auth_client.get(f"/api/v1/skills/{created['id']}").status_code == 404


def test_duplicate_skill_slug_is_rejected(app, auth_client):
    workspace_id = _workspace_id(app)
    _create_skill(auth_client, workspace_id)

    duplicate = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/skills",
        json={"name": "Riset Ringkas", "instructions": "Instruksi lain."},
    )

    assert duplicate.status_code == 409


def test_orchestration_preserves_skill_order_and_can_be_updated(app, auth_client):
    workspace_id = _workspace_id(app)
    first = _create_skill(auth_client, workspace_id, "Riset")
    second = _create_skill(auth_client, workspace_id, "Editor")

    created = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/orchestrations",
        json={
            "name": "Brief Mingguan",
            "description": "Riset lalu rapikan hasil.",
            "skill_ids": [first["id"], second["id"]],
        },
    )

    assert created.status_code == 201
    assert [step["skill"]["id"] for step in created.json()["steps"]] == [
        first["id"],
        second["id"],
    ]

    updated = auth_client.patch(
        f"/api/v1/orchestrations/{created.json()['id']}",
        json={"name": "Brief Final", "skill_ids": [second["id"], first["id"]]},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Brief Final"
    assert [step["position"] for step in updated.json()["steps"]] == [0, 1]
    assert [step["skill"]["id"] for step in updated.json()["steps"]] == [
        second["id"],
        first["id"],
    ]

    assert auth_client.delete(f"/api/v1/orchestrations/{created.json()['id']}").status_code == 204


def test_orchestration_rejects_foreign_or_duplicate_skills(app, auth_client):
    bisa_id = _workspace_id(app)
    personal_id = _workspace_id(app, "personal")
    bisa_skill = _create_skill(auth_client, bisa_id, "Bisa Skill")
    personal_skill = _create_skill(auth_client, personal_id, "Personal Skill")

    foreign = auth_client.post(
        f"/api/v1/workspaces/{bisa_id}/orchestrations",
        json={"name": "Invalid", "skill_ids": [personal_skill["id"]]},
    )
    duplicate = auth_client.post(
        f"/api/v1/workspaces/{bisa_id}/orchestrations",
        json={"name": "Duplicate", "skill_ids": [bisa_skill["id"], bisa_skill["id"]]},
    )

    assert foreign.status_code == 422
    assert duplicate.status_code == 422


def test_deleting_skill_used_by_orchestration_is_rejected(app, auth_client):
    workspace_id = _workspace_id(app)
    skill = _create_skill(auth_client, workspace_id)
    orchestration = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/orchestrations",
        json={"name": "Single", "skill_ids": [skill["id"]]},
    ).json()

    deleted = auth_client.delete(f"/api/v1/skills/{skill['id']}")
    fetched = auth_client.get(f"/api/v1/orchestrations/{orchestration['id']}")

    assert deleted.status_code == 409
    assert fetched.status_code == 200
    assert [step["skill"]["id"] for step in fetched.json()["steps"]] == [skill["id"]]


def test_skill_and_orchestration_updates_reject_null_required_fields(app, auth_client):
    workspace_id = _workspace_id(app)
    skill = _create_skill(auth_client, workspace_id)
    orchestration = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/orchestrations",
        json={"name": "Single", "skill_ids": [skill["id"]]},
    ).json()

    for field in ("name", "slug", "instructions", "is_enabled"):
        response = auth_client.patch(f"/api/v1/skills/{skill['id']}", json={field: None})
        assert response.status_code == 422, field

    response = auth_client.patch(
        f"/api/v1/orchestrations/{orchestration['id']}", json={"name": None}
    )
    assert response.status_code == 422
