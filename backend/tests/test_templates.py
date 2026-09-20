def get_workspace(client, slug="bisa-ai"):
    return client.get(f"/api/v1/workspaces/{slug}").json()


def create_template(client, workspace_id, **overrides):
    payload = {
        "workspace_id": workspace_id,
        "name": "Teaching Session Template",
        "description": "Reusable session defaults",
        "template_type": "teaching_session",
        "category": "training",
        "config_json": {"duration_minutes": 90},
    }
    payload.update(overrides)
    return client.post("/api/v1/templates", json=payload)


def test_template_routes_require_authentication(client):
    assert client.get("/api/v1/templates", params={"workspace_id": 1}).status_code == 401


def test_template_crud(auth_client):
    workspace = get_workspace(auth_client)
    created = create_template(auth_client, workspace["id"])

    assert created.status_code == 201
    template_id = created.json()["id"]
    assert created.json()["config_json"] == {"duration_minutes": 90}

    fetched = auth_client.get(f"/api/v1/templates/{template_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Teaching Session Template"

    updated = auth_client.patch(
        f"/api/v1/templates/{template_id}",
        json={"name": "Updated Template", "config_json": {"duration_minutes": 60}},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Template"
    assert updated.json()["config_json"] == {"duration_minutes": 60}

    deleted = auth_client.delete(f"/api/v1/templates/{template_id}")
    assert deleted.status_code == 204
    assert auth_client.get(f"/api/v1/templates/{template_id}").status_code == 404


def test_template_list_supports_global_and_workspace_filters(auth_client):
    workspace = get_workspace(auth_client)
    other = get_workspace(auth_client, "personal")
    create_template(auth_client, workspace["id"], name="Workspace Template")
    create_template(auth_client, None, name="Global Template", category="global")
    create_template(auth_client, other["id"], name="Other Template")

    response = auth_client.get("/api/v1/templates", params={"workspace_id": workspace["id"]})

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert {item["name"] for item in response.json()["items"]} == {
        "Workspace Template",
        "Global Template",
    }


def test_template_rejects_inaccessible_workspace(auth_client):
    response = create_template(auth_client, 99999)

    assert response.status_code == 404
    assert response.json()["detail"] == "Workspace not found"


def test_template_rejects_unknown_fields(auth_client):
    workspace = get_workspace(auth_client)
    response = create_template(auth_client, workspace["id"], content="ignored")

    assert response.status_code == 422
