def get_workspace(client, slug="bisa-ai"):
    return client.get(f"/api/v1/workspaces/{slug}").json()


def create_material(client, workspace_id, module_id=None, **overrides):
    payload = {
        "workspace_id": workspace_id,
        "module_id": module_id,
        "title": "Python Handbook",
        "description": "Course reference",
        "material_type": "document",
        "material_date": "2026-09-10",
        "content_url": "https://example.com/python.pdf",
        "tags": ["python", "teaching"],
    }
    payload.update(overrides)
    return client.post("/api/v1/materials", json=payload)


def test_material_routes_require_authentication(client):
    assert client.get("/api/v1/materials", params={"workspace_id": 1}).status_code == 401


def test_material_crud(auth_client):
    workspace = get_workspace(auth_client)
    module_id = workspace["modules"][0]["id"]
    created = create_material(auth_client, workspace["id"], module_id)

    assert created.status_code == 201
    material_id = created.json()["id"]
    assert created.json()["material_type"] == "document"
    assert created.json()["tags"] == ["python", "teaching"]

    fetched = auth_client.get(f"/api/v1/materials/{material_id}")
    assert fetched.status_code == 200

    updated = auth_client.patch(
        f"/api/v1/materials/{material_id}",
        json={"title": "Updated Handbook", "material_type": "presentation"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated Handbook"
    assert updated.json()["material_type"] == "presentation"

    deleted = auth_client.delete(f"/api/v1/materials/{material_id}")
    assert deleted.status_code == 204
    assert auth_client.get(f"/api/v1/materials/{material_id}").status_code == 404


def test_material_list_filters_and_pagination(auth_client):
    workspace = get_workspace(auth_client)
    teaching_module = workspace["modules"][0]["id"]
    projects_module = workspace["modules"][1]["id"]
    create_material(auth_client, workspace["id"], teaching_module, title="Python Guide")
    create_material(
        auth_client,
        workspace["id"],
        projects_module,
        title="Project Slides",
        description="Quarterly deck",
        material_type="presentation",
        material_date="2026-09-11",
    )
    create_material(
        auth_client,
        workspace["id"],
        teaching_module,
        title="Python Video",
        material_type="video",
        material_date="2026-09-10",
    )

    filtered = auth_client.get(
        "/api/v1/materials",
        params={
            "workspace_id": workspace["id"],
            "module_id": teaching_module,
            "material_type": "document",
            "date": "2026-09-10",
            "search": "python",
        },
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["title"] == "Python Guide"

    paged = auth_client.get(
        "/api/v1/materials",
        params={"workspace_id": workspace["id"], "page": 2, "page_size": 2},
    )
    assert paged.status_code == 200
    assert paged.json()["pages"] == 2
    assert len(paged.json()["items"]) == 1


def test_material_rejects_module_from_other_workspace(auth_client):
    company = get_workspace(auth_client, "bisa-ai")
    personal = get_workspace(auth_client, "personal")
    response = create_material(auth_client, company["id"], personal["modules"][0]["id"])

    assert response.status_code == 422
    assert response.json()["detail"] == "Module does not belong to workspace"


def test_material_rejects_session_from_other_workspace(auth_client):
    company = get_workspace(auth_client, "bisa-ai")
    personal = get_workspace(auth_client, "personal")
    teaching_session = auth_client.post(
        f"/api/v1/workspaces/{personal['id']}/teaching/sessions",
        json={"title": "Private session"},
    ).json()

    response = create_material(
        auth_client,
        company["id"],
        session_id=teaching_session["id"],
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Teaching session does not belong to workspace"


def test_material_supports_requested_domain_fields(auth_client):
    workspace = get_workspace(auth_client)
    response = create_material(
        auth_client,
        workspace["id"],
        status="ready",
        file_path="/data/materials/handbook.pdf",
        metadata_json={"pages": 12},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ready"
    assert response.json()["file_path"] == "/data/materials/handbook.pdf"
    assert response.json()["metadata_json"] == {"pages": 12}
