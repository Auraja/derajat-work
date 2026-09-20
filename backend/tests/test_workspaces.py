def test_workspace_list_requires_authentication(client):
    assert client.get("/api/v1/workspaces").status_code == 401


def test_seeded_workspaces_include_expected_modules(auth_client):
    response = auth_client.get("/api/v1/workspaces")

    assert response.status_code == 200
    workspaces = {item["slug"]: item for item in response.json()}
    assert set(workspaces) == {"bisa-ai", "solusi-kecerdasan-buatan", "personal"}
    assert [module["name"] for module in workspaces["bisa-ai"]["modules"]] == [
        "Teaching",
        "Projects",
        "Files",
    ]
    assert [module["name"] for module in workspaces["personal"]["modules"]] == [
        "Research",
        "Notes",
        "Projects",
    ]


def test_workspace_can_be_fetched_by_slug_or_id(auth_client):
    by_slug = auth_client.get("/api/v1/workspaces/bisa-ai")
    assert by_slug.status_code == 200

    by_id = auth_client.get(f"/api/v1/workspaces/{by_slug.json()['id']}")

    assert by_id.status_code == 200
    assert by_id.json()["slug"] == "bisa-ai"


def test_workspace_creation_makes_creator_owner(auth_client):
    created = auth_client.post(
        "/api/v1/workspaces",
        json={
            "name": "Community Lab",
            "description": "Shared experiments",
            "workspace_type": "organization",
        },
    )

    assert created.status_code == 201
    assert created.json()["slug"] == "community-lab"
    assert created.json()["role"] == "owner"
    listed = auth_client.get("/api/v1/workspaces").json()
    assert any(item["slug"] == "community-lab" for item in listed)


def test_duplicate_workspace_slug_is_rejected(auth_client):
    response = auth_client.post(
        "/api/v1/workspaces",
        json={"name": "Other", "slug": "personal", "workspace_type": "personal"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace slug already exists"


def test_unknown_or_inaccessible_workspace_returns_not_found(auth_client):
    response = auth_client.get("/api/v1/workspaces/does-not-exist")

    assert response.status_code == 404


def test_workspace_can_be_updated_and_deleted(auth_client):
    created = auth_client.post(
        "/api/v1/workspaces",
        json={"name": "Studio Lama", "workspace_type": "personal"},
    ).json()

    updated = auth_client.patch(
        f"/api/v1/workspaces/{created['id']}",
        json={
            "name": "Studio Pribadi",
            "slug": "studio-pribadi",
            "description": "Ruang tenang untuk pekerjaan pilihan.",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "Studio Pribadi"
    assert updated.json()["slug"] == "studio-pribadi"
    assert auth_client.get("/api/v1/workspaces/studio-lama").status_code == 404

    deleted = auth_client.delete(f"/api/v1/workspaces/{created['id']}")

    assert deleted.status_code == 204
    assert auth_client.get("/api/v1/workspaces/studio-pribadi").status_code == 404


def test_workspace_update_rejects_duplicate_slug(auth_client):
    created = auth_client.post(
        "/api/v1/workspaces",
        json={"name": "Studio", "workspace_type": "personal"},
    ).json()

    response = auth_client.patch(f"/api/v1/workspaces/{created['id']}", json={"slug": "personal"})

    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace slug already exists"


def test_workspace_update_rejects_null_for_required_fields(auth_client):
    workspace = auth_client.get("/api/v1/workspaces/personal").json()

    for field in ("name", "slug", "workspace_type"):
        response = auth_client.patch(f"/api/v1/workspaces/{workspace['id']}", json={field: None})

        assert response.status_code == 422, field
