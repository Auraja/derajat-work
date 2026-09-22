import pytest


def workspace_id(client, slug="bisa-ai"):
    return client.get(f"/api/v1/workspaces/{slug}").json()["id"]


def create_session(client, workspace, **overrides):
    payload = {
        "title": "Python Fundamentals",
        "description": "Core Python class",
        "instructor": "Test Admin",
        "scheduled_at": "2026-09-10T09:00:00Z",
        "duration_minutes": 90,
        "status": "scheduled",
        "notes": "Bring a laptop",
    }
    payload.update(overrides)
    return client.post(f"/api/v1/workspaces/{workspace}/teaching/sessions", json=payload)


@pytest.mark.parametrize(
    "status",
    [
        "draft",
        "preparing",
        "ready",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
    ],
)
def test_required_teaching_statuses_are_accepted(auth_client, status):
    workspace = workspace_id(auth_client)
    response = create_session(auth_client, workspace, status=status)

    assert response.status_code == 201
    assert response.json()["status"] == status


def test_archived_status_is_reserved_for_the_archive_endpoint(auth_client):
    workspace = workspace_id(auth_client)

    created = create_session(auth_client, workspace, status="archived")
    assert created.status_code == 422

    session_id = create_session(auth_client, workspace).json()["id"]
    updated = auth_client.patch(
        f"/api/v1/teaching/sessions/{session_id}",
        json={"status": "archived"},
    )

    assert updated.status_code == 422
    assert auth_client.get(f"/api/v1/teaching/sessions/{session_id}").status_code == 200


def test_teaching_routes_require_authentication(client):
    response = client.get("/api/v1/workspaces/1/teaching/sessions")
    assert response.status_code == 401


def test_teaching_session_crud_and_archive(auth_client):
    workspace = workspace_id(auth_client)
    created = create_session(auth_client, workspace)

    assert created.status_code == 201
    session_id = created.json()["id"]
    assert created.json()["status"] == "scheduled"

    fetched = auth_client.get(f"/api/v1/teaching/sessions/{session_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Python Fundamentals"

    updated = auth_client.patch(
        f"/api/v1/teaching/sessions/{session_id}",
        json={"title": "Advanced Python", "status": "completed"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Advanced Python"
    assert updated.json()["status"] == "completed"

    deleted = auth_client.delete(f"/api/v1/teaching/sessions/{session_id}")
    assert deleted.status_code == 204
    assert auth_client.get(f"/api/v1/teaching/sessions/{session_id}").status_code == 404

    listing = auth_client.get(f"/api/v1/workspaces/{workspace}/teaching/sessions").json()
    assert listing["total"] == 0


def test_teaching_list_filters_sorts_and_paginates(auth_client):
    workspace = workspace_id(auth_client)
    create_session(auth_client, workspace, title="Python Basics", status="scheduled")
    create_session(
        auth_client,
        workspace,
        title="Data Engineering",
        description="Pipelines and SQL",
        status="completed",
        scheduled_at="2026-09-12T09:00:00Z",
    )
    create_session(
        auth_client,
        workspace,
        title="Advanced Python",
        status="scheduled",
        scheduled_at="2026-09-11T09:00:00Z",
    )

    filtered = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "python", "status": "scheduled", "sort": "title", "order": "desc"},
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 2
    assert [item["title"] for item in filtered.json()["items"]] == [
        "Python Basics",
        "Advanced Python",
    ]

    paged = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"page": 2, "page_size": 2, "sort": "scheduled_at", "order": "asc"},
    )
    assert paged.status_code == 200
    assert paged.json()["page"] == 2
    assert paged.json()["page_size"] == 2
    assert paged.json()["pages"] == 2
    assert len(paged.json()["items"]) == 1


def test_teaching_list_searches_session_topics(auth_client):
    workspace = workspace_id(auth_client)
    create_session(
        auth_client,
        workspace,
        title="Pertemuan pertama",
        topic="Machine Learning",
    )

    response = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "machine"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["topic"] == "Machine Learning"


def test_teaching_list_searches_session_types(auth_client):
    workspace = workspace_id(auth_client)
    create_session(
        auth_client,
        workspace,
        title="Pertemuan kedua",
        session_type="Lokakarya intensif",
    )

    response = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "lokakarya"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["session_type"] == "Lokakarya intensif"


def test_teaching_validates_status_sort_and_page_size(auth_client):
    workspace = workspace_id(auth_client)

    bad_status = create_session(auth_client, workspace, status="impossible")
    bad_sort = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions", params={"sort": "nope"}
    )
    bad_page = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions", params={"page_size": 101}
    )

    assert bad_status.status_code == 422
    assert bad_sort.status_code == 422
    assert bad_page.status_code == 422


def test_teaching_session_supports_requested_domain_fields(auth_client):
    workspace = workspace_id(auth_client)
    response = create_session(
        auth_client,
        workspace,
        topic="Python syntax",
        audience="Beginners",
        difficulty="beginner",
        session_type="workshop",
        session_date="2026-09-10",
    )

    assert response.status_code == 201
    assert response.json()["topic"] == "Python syntax"
    assert response.json()["audience"] == "Beginners"
    assert response.json()["difficulty"] == "beginner"
    assert response.json()["session_type"] == "workshop"
    assert response.json()["session_date"] == "2026-09-10"


def test_teaching_session_retains_external_import_contract_and_aliases(auth_client):
    workspace = workspace_id(auth_client)
    response = auth_client.post(
        f"/api/v1/workspaces/{workspace}/teaching/sessions/import",
        json={
            "sessions": [
                {
                    "title": "Kelas AI eksternal",
                    "location": "Lab 2",
                    "participantCount": 24,
                    "participantLabel": "Mahasiswa semester 3",
                    "source": "external_ai",
                    "instructors": ["Ayu", "Bima"],
                    "activities": [
                        {
                            "type": "workshop",
                            "startDate": "2026-10-10",
                            "endDate": "2026-10-11",
                            "mode": "offline",
                        }
                    ],
                }
            ]
        },
    )

    assert response.status_code == 201
    saved = response.json()[0]
    assert saved["location"] == "Lab 2"
    assert saved["participant_count"] == 24
    assert saved["participant_label"] == "Mahasiswa semester 3"
    assert saved["source"] == "external_ai"
    assert saved["instructors"] == ["Ayu", "Bima"]
    assert saved["activities"][0]["type"] == "workshop"


def test_teaching_session_defaults_source_and_patch_preserves_schedule_lists(auth_client):
    workspace = workspace_id(auth_client)
    created = create_session(
        auth_client,
        workspace,
        instructors=["Ayu"],
        activities=[
            {
                "type": "class",
                "startDate": "2026-10-10",
                "endDate": "2026-10-10",
                "mode": "online",
            }
        ],
    )
    assert created.status_code == 201
    assert created.json()["source"] == "manual"

    updated = auth_client.patch(
        f"/api/v1/teaching/sessions/{created.json()['id']}",
        json={"location": "Zoom"},
    )

    assert updated.status_code == 200
    assert updated.json()["location"] == "Zoom"
    assert updated.json()["instructors"] == ["Ayu"]
    assert updated.json()["activities"][0]["mode"] == "online"


def test_teaching_list_searches_location_and_participant_label(auth_client):
    workspace = workspace_id(auth_client)
    create_session(
        auth_client,
        workspace,
        title="Kelas privat",
        location="Kampus Merdeka",
        participant_label="Peserta beasiswa",
    )

    by_location = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "merdeka"},
    )
    by_participant = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "beasiswa"},
    )

    assert by_location.status_code == 200
    assert by_location.json()["total"] == 1
    assert by_participant.status_code == 200
    assert by_participant.json()["total"] == 1


def test_teaching_list_searches_structured_instructors(auth_client):
    workspace = workspace_id(auth_client)
    create_session(
        auth_client,
        workspace,
        title="Kelas bersama",
        instructor=None,
        instructors=["Ayu Pratama", "Bima"],
    )

    response = auth_client.get(
        f"/api/v1/workspaces/{workspace}/teaching/sessions",
        params={"search": "ayu"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["instructors"] == ["Ayu Pratama", "Bima"]


@pytest.mark.parametrize("field", ["title", "status", "source"])
def test_teaching_patch_rejects_null_for_non_nullable_fields(auth_client, field):
    workspace = workspace_id(auth_client)
    created = create_session(auth_client, workspace)

    response = auth_client.patch(
        f"/api/v1/teaching/sessions/{created.json()['id']}",
        json={field: None},
    )

    assert response.status_code == 422


def test_teaching_server_controls_source_provenance(auth_client):
    workspace = workspace_id(auth_client)

    manual = create_session(auth_client, workspace, source="external_ai")
    imported = auth_client.post(
        f"/api/v1/workspaces/{workspace}/teaching/sessions/import",
        json={
            "sessions": [
                {
                    "title": "Import provenance",
                    "source": "manual",
                    "instructors": ["Ayu"],
                    "activities": [
                        {
                            "type": "class",
                            "startDate": "2026-10-10",
                            "endDate": "2026-10-10",
                        }
                    ],
                }
            ]
        },
    )

    assert manual.status_code == 201
    assert manual.json()["source"] == "manual"
    assert imported.status_code == 201
    assert imported.json()[0]["source"] == "external_ai"


def test_teaching_import_rejects_unknown_fields(auth_client):
    workspace = workspace_id(auth_client)
    response = auth_client.post(
        f"/api/v1/workspaces/{workspace}/teaching/sessions/import",
        json={
            "sessions": [
                {
                    "title": "Strict import",
                }
            ],
            "unexpectedRoot": True,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": "   "},
        {"instructors": []},
        {"instructors": ["   "]},
        {"activities": []},
        {
            "activities": [
                {
                    "type": "   ",
                    "startDate": "2026-10-10",
                    "endDate": "2026-10-10",
                }
            ]
        },
    ],
)
def test_teaching_import_rejects_empty_required_schedule_values(auth_client, overrides):
    workspace = workspace_id(auth_client)
    item = {
        "title": "Strict import",
        "instructors": ["Ayu"],
        "activities": [
            {
                "type": "class",
                "startDate": "2026-10-10",
                "endDate": "2026-10-10",
            }
        ],
    }
    item.update(overrides)

    response = auth_client.post(
        f"/api/v1/workspaces/{workspace}/teaching/sessions/import",
        json={"sessions": [item]},
    )

    assert response.status_code == 422
