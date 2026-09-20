import pytest
from pydantic import ValidationError

from app.core.security import hash_password
from app.models import KanbanColumn, User, WorkspaceMember, WorkspaceRole
from app.schemas.kanban import CardUpdate, ColumnCreate


def add_user(app, *, email: str, memberships: list[tuple[int, WorkspaceRole]]) -> None:
    with app.state.session_factory() as session:
        user = User(
            email=email,
            password_hash=hash_password("test-password"),
            name=email,
            is_admin=False,
        )
        session.add(user)
        session.flush()
        session.add_all(
            WorkspaceMember(workspace_id=workspace, user_id=user.id, role=role)
            for workspace, role in memberships
        )
        session.commit()


def login(client, email: str) -> None:
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": email, "password": "test-password"}
        ).status_code
        == 200
    )


def workspace_id(client):
    return client.get("/api/v1/workspaces/bisa-ai").json()["id"]


CANONICAL_STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done"]


def test_empty_global_board_always_returns_one_canonical_status_set(auth_client):
    board = auth_client.get("/api/v1/kanban")
    assert board.status_code == 200
    assert [column["title"] for column in board.json()["columns"]] == CANONICAL_STATUSES


def test_global_board_does_not_duplicate_statuses_across_workspaces(auth_client):
    auth_client.post("/api/v1/workspaces", json={"name": "PT Kedua"})
    board = auth_client.get("/api/v1/kanban").json()
    assert [column["title"] for column in board["columns"]] == CANONICAL_STATUSES
    assert len({column["id"] for column in board["columns"]}) == 5


def test_only_done_cards_can_be_archived_and_restored(auth_client):
    workspace = workspace_id(auth_client)
    board = auth_client.get("/api/v1/kanban").json()
    backlog, done = board["columns"][0], board["columns"][-1]
    active = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": backlog["id"], "workspace_id": workspace, "title": "Belum selesai"},
    ).json()
    completed = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": done["id"], "workspace_id": workspace, "title": "Sudah selesai"},
    ).json()

    assert auth_client.post(f"/api/v1/kanban/cards/{active['id']}/archive").status_code == 409
    archived = auth_client.post(f"/api/v1/kanban/cards/{completed['id']}/archive")
    assert archived.status_code == 200
    assert archived.json()["archived_at"]

    board = auth_client.get("/api/v1/kanban").json()
    assert all(
        card["id"] != completed["id"]
        for column in board["columns"]
        for card in column["cards"]
    )
    assert [card["id"] for card in board["archived_cards"]] == [completed["id"]]

    restored = auth_client.post(f"/api/v1/kanban/cards/{completed['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["archived_at"] is None
    board = auth_client.get("/api/v1/kanban").json()
    assert board["archived_cards"] == []
    assert completed["id"] in [card["id"] for card in board["columns"][-1]["cards"]]


def test_canonical_status_movement_uses_assignment_acl_not_column_owner(app, auth_client):
    assignment_id = workspace_id(auth_client)
    board = auth_client.get("/api/v1/kanban").json()
    backlog, todo = board["columns"][:2]
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": backlog["id"], "workspace_id": assignment_id, "title": "Move me"},
    ).json()
    moved = auth_client.patch(
        f"/api/v1/kanban/cards/{card['id']}",
        json={"column_id": todo["id"], "position": 0},
    )
    assert moved.status_code == 200
    assert moved.json()["column_id"] == todo["id"]
    with app.state.session_factory() as session:
        assert session.get(KanbanColumn, todo["id"]).workspace_id is None


def test_column_title_schema_matches_database_limit():
    with pytest.raises(ValidationError):
        ColumnCreate(title="x" * 161)


@pytest.mark.parametrize("field", ["title", "column_id", "workspace_id", "position"])
def test_card_update_rejects_null_for_non_nullable_fields(field):
    with pytest.raises(ValidationError):
        CardUpdate.model_validate({field: None})


def test_kanban_column_and_card_crud_and_move(auth_client):
    wid = workspace_id(auth_client)
    todo = auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/columns", json={"title": "Akan dikerjakan"}
    )
    assert todo.status_code == 201
    doing = auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/columns", json={"title": "Dikerjakan"}
    )
    card = auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/cards",
        json={
            "column_id": todo.json()["id"],
            "title": "Susun proposal",
            "description": "Draf awal",
        },
    )
    assert card.status_code == 201
    renamed = auth_client.patch(
        f"/api/v1/workspaces/{wid}/kanban/columns/{todo.json()['id']}",
        json={"title": "Daftar tugas"},
    )
    assert renamed.json()["title"] == "To Do"
    edited = auth_client.patch(
        f"/api/v1/workspaces/{wid}/kanban/cards/{card.json()['id']}",
        json={"title": "Susun proposal final", "column_id": doing.json()["id"]},
    )
    assert edited.json()["column_id"] == doing.json()["id"]
    board = auth_client.get(f"/api/v1/workspaces/{wid}/kanban")
    assert board.status_code == 200
    in_progress = next(
        column for column in board.json()["columns"] if column["title"] == "In Progress"
    )
    assert in_progress["cards"][0]["title"] == "Susun proposal final"
    assert (
        auth_client.delete(f"/api/v1/workspaces/{wid}/kanban/cards/{card.json()['id']}").status_code
        == 204
    )
    assert (
        auth_client.delete(
            f"/api/v1/workspaces/{wid}/kanban/columns/{todo.json()['id']}"
        ).status_code
        == 204
    )


def test_column_with_cards_requires_safe_cleanup(auth_client):
    wid = workspace_id(auth_client)
    column = auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/columns", json={"title": "Isi"}
    ).json()
    auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/cards", json={"column_id": column["id"], "title": "Data"}
    )
    response = auth_client.delete(f"/api/v1/workspaces/{wid}/kanban/columns/{column['id']}")
    assert response.status_code == 409
    assert "kartu" in response.json()["detail"].lower()


def test_viewer_reads_but_cannot_mutate_kanban(app, auth_client):
    wid = workspace_id(auth_client)
    auth_client.post(f"/api/v1/workspaces/{wid}/kanban/columns", json={"title": "Terlihat"})
    with app.state.session_factory() as session:
        viewer = User(
            email="kanban-viewer@example.com",
            password_hash=hash_password("viewer-password"),
            name="Viewer",
            is_admin=False,
        )
        session.add(viewer)
        session.flush()
        session.add(WorkspaceMember(workspace_id=wid, user_id=viewer.id, role=WorkspaceRole.viewer))
        session.commit()
    assert (
        auth_client.post(
            "/api/v1/auth/login",
            json={"email": "kanban-viewer@example.com", "password": "viewer-password"},
        ).status_code
        == 200
    )
    assert auth_client.get(f"/api/v1/workspaces/{wid}/kanban").status_code == 200
    assert (
        auth_client.post(
            f"/api/v1/workspaces/{wid}/kanban/columns", json={"title": "Ditolak"}
        ).status_code
        == 403
    )


def test_owner_manages_modules_and_cannot_remove_projects_with_data(auth_client):
    wid = workspace_id(auth_client)
    made = auth_client.post(
        f"/api/v1/workspaces/{wid}/modules", json={"name": "Catatan Tim", "slug": "team-notes"}
    )
    assert made.status_code == 201
    assert (
        auth_client.delete(f"/api/v1/workspaces/{wid}/modules/{made.json()['id']}").status_code
        == 204
    )
    backlog = auth_client.get("/api/v1/kanban").json()["columns"][0]
    auth_client.post(
        f"/api/v1/workspaces/{wid}/kanban/cards",
        json={"column_id": backlog["id"], "title": "Data proyek"},
    )
    workspace = auth_client.get(f"/api/v1/workspaces/{wid}").json()
    projects = next(module for module in workspace["modules"] if module["slug"] == "projects")
    blocked = auth_client.delete(f"/api/v1/workspaces/{wid}/modules/{projects['id']}")
    assert blocked.status_code == 409
    assert "data" in blocked.json()["detail"].lower()


def test_global_kanban_aggregates_accessible_workspaces_and_delegates(auth_client):
    first_id = workspace_id(auth_client)
    second = auth_client.post(
        "/api/v1/workspaces", json={"name": "PT Tujuan", "description": "Delegasi"}
    )
    assert second.status_code == 201
    second_id = second.json()["id"]
    column = auth_client.post(
        f"/api/v1/workspaces/{first_id}/kanban/columns", json={"title": "Dikerjakan"}
    ).json()
    created = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": column["id"], "workspace_id": first_id, "title": "Lintas PT"},
    )
    assert created.status_code == 201
    delegated = auth_client.patch(
        f"/api/v1/kanban/cards/{created.json()['id']}",
        json={"workspace_id": second_id, "position": 0},
    )
    assert delegated.status_code == 200
    assert delegated.json()["workspace_id"] == second_id
    board = auth_client.get("/api/v1/kanban")
    assert board.status_code == 200
    assert {item["id"] for item in board.json()["workspaces"]} >= {first_id, second_id}
    status = next(item for item in board.json()["columns"] if item["title"] == "In Progress")
    assert status["cards"][0]["workspace_id"] == second_id


def test_global_kanban_rejects_delegation_to_read_only_target(app, auth_client):
    from sqlalchemy import select

    from app.models import Workspace

    source_id = workspace_id(auth_client)
    column = auth_client.post(
        f"/api/v1/workspaces/{source_id}/kanban/columns", json={"title": "Masuk"}
    ).json()
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": column["id"], "workspace_id": source_id, "title": "Terbatas"},
    ).json()
    with app.state.session_factory() as session:
        from app.models import Workspace, WorkspaceType

        user = session.scalar(select(User).where(User.email == "admin@example.com"))
        target = Workspace(
            name="PT Read Only",
            slug="pt-read-only",
            description="",
            workspace_type=WorkspaceType.company,
        )
        session.add(target)
        session.flush()
        session.add(
            WorkspaceMember(workspace_id=target.id, user_id=user.id, role=WorkspaceRole.viewer)
        )
        session.commit()
        target_id = target.id
    denied = auth_client.patch(
        f"/api/v1/kanban/cards/{card['id']}", json={"workspace_id": target_id}
    )
    assert denied.status_code == 403


def test_assignment_recipient_discovers_card_without_source_membership(app, auth_client):
    source_id = workspace_id(auth_client)
    destination = auth_client.post("/api/v1/workspaces", json={"name": "Recipient"}).json()
    column = auth_client.post(
        f"/api/v1/workspaces/{source_id}/kanban/columns", json={"title": "Shared status"}
    ).json()
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": column["id"],
            "workspace_id": destination["id"],
            "title": "Delegated secret",
        },
    )
    assert card.status_code == 201
    add_user(
        app,
        email="recipient@example.com",
        memberships=[(destination["id"], WorkspaceRole.admin)],
    )
    login(auth_client, "recipient@example.com")

    board = auth_client.get("/api/v1/kanban")

    assert board.status_code == 200
    assert [item["title"] for item in board.json()["columns"][0]["cards"]] == ["Delegated secret"]
    assert board.json()["columns"][0]["title"] == "Backlog"


def test_legacy_board_and_mutations_enforce_card_assignment_acl(app, auth_client):
    source_id = workspace_id(auth_client)
    destination = auth_client.post("/api/v1/workspaces", json={"name": "Private target"}).json()
    column = auth_client.post(
        f"/api/v1/workspaces/{source_id}/kanban/columns", json={"title": "Source status"}
    ).json()
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": column["id"],
            "workspace_id": destination["id"],
            "title": "Target-only content",
        },
    ).json()
    add_user(
        app,
        email="source-only@example.com",
        memberships=[(source_id, WorkspaceRole.admin)],
    )
    login(auth_client, "source-only@example.com")

    board = auth_client.get(f"/api/v1/workspaces/{source_id}/kanban")

    assert board.status_code == 200
    assert board.json()["columns"][0]["cards"] == []
    assert (
        auth_client.patch(
            f"/api/v1/workspaces/{source_id}/kanban/cards/{card['id']}",
            json={"title": "Leaked edit"},
        ).status_code
        == 404
    )
    assert (
        auth_client.delete(f"/api/v1/workspaces/{source_id}/kanban/cards/{card['id']}").status_code
        == 404
    )


def test_global_create_and_move_ignore_irrelevant_legacy_status_workspace_acl(app, auth_client):
    assignment_id = workspace_id(auth_client)
    status_workspace = auth_client.post("/api/v1/workspaces", json={"name": "Status owner"}).json()
    target_column = auth_client.post(
        f"/api/v1/workspaces/{status_workspace['id']}/kanban/columns",
        json={"title": "Protected workflow"},
    ).json()
    source_column = auth_client.post(
        f"/api/v1/workspaces/{assignment_id}/kanban/columns", json={"title": "Writable"}
    ).json()
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": source_column["id"],
            "workspace_id": assignment_id,
            "title": "Cannot move",
        },
    ).json()
    add_user(
        app,
        email="workflow-viewer@example.com",
        memberships=[
            (assignment_id, WorkspaceRole.admin),
            (status_workspace["id"], WorkspaceRole.viewer),
        ],
    )
    login(auth_client, "workflow-viewer@example.com")

    created = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": target_column["id"],
            "workspace_id": assignment_id,
            "title": "Denied create",
        },
    )
    moved = auth_client.patch(
        f"/api/v1/kanban/cards/{card['id']}", json={"column_id": target_column["id"]}
    )

    assert created.status_code == 201
    assert moved.status_code == 200


def test_global_position_only_reorder_uses_assignment_workspace_access(app, auth_client):
    assignment_id = workspace_id(auth_client)
    status_workspace = auth_client.post(
        "/api/v1/workspaces", json={"name": "Read-only workflow"}
    ).json()
    column = auth_client.post(
        f"/api/v1/workspaces/{status_workspace['id']}/kanban/columns",
        json={"title": "Protected ordering"},
    ).json()
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={"column_id": column["id"], "workspace_id": assignment_id, "title": "Fixed"},
    ).json()
    add_user(
        app,
        email="reorder-viewer@example.com",
        memberships=[
            (assignment_id, WorkspaceRole.admin),
            (status_workspace["id"], WorkspaceRole.viewer),
        ],
    )
    login(auth_client, "reorder-viewer@example.com")

    response = auth_client.patch(f"/api/v1/kanban/cards/{card['id']}", json={"position": 0})

    assert response.status_code == 200


def test_global_board_exposes_destination_capabilities_per_visible_column(app, auth_client):
    writable_id = workspace_id(auth_client)
    readonly = auth_client.post("/api/v1/workspaces", json={"name": "Visible read only"}).json()
    writable_column = auth_client.post(
        f"/api/v1/workspaces/{writable_id}/kanban/columns", json={"title": "Writable status"}
    ).json()
    readonly_column = auth_client.post(
        f"/api/v1/workspaces/{readonly['id']}/kanban/columns", json={"title": "Read-only status"}
    ).json()
    add_user(
        app,
        email="capabilities@example.com",
        memberships=[
            (writable_id, WorkspaceRole.admin),
            (readonly["id"], WorkspaceRole.viewer),
        ],
    )
    login(auth_client, "capabilities@example.com")

    columns = {item["id"]: item for item in auth_client.get("/api/v1/kanban").json()["columns"]}

    assert columns[writable_column["id"]]["can_write"] is True
    assert columns[writable_column["id"]]["can_create"] is True
    assert columns[writable_column["id"]]["can_move_into"] is True
    assert columns[readonly_column["id"]]["can_write"] is True
    assert columns[readonly_column["id"]]["can_create"] is True
    assert columns[readonly_column["id"]]["can_move_into"] is True


def test_card_reorder_is_deterministic_and_contiguous_across_assignments(auth_client):
    first_id = workspace_id(auth_client)
    second_id = auth_client.post("/api/v1/workspaces", json={"name": "Second assignee"}).json()[
        "id"
    ]
    first_column = auth_client.post(
        f"/api/v1/workspaces/{first_id}/kanban/columns", json={"title": "Backlog"}
    ).json()
    second_column = auth_client.post(
        f"/api/v1/workspaces/{first_id}/kanban/columns", json={"title": "Done"}
    ).json()

    cards = []
    for title, assignment in [("A", first_id), ("B", second_id), ("C", first_id)]:
        response = auth_client.post(
            "/api/v1/kanban/cards",
            json={
                "column_id": first_column["id"],
                "workspace_id": assignment,
                "title": title,
            },
        )
        assert response.status_code == 201
        cards.append(response.json())
    assert [card["position"] for card in cards] == [0, 1, 2]

    assert (
        auth_client.patch(
            f"/api/v1/kanban/cards/{cards[2]['id']}", json={"position": 0}
        ).status_code
        == 200
    )
    assert (
        auth_client.patch(
            f"/api/v1/kanban/cards/{cards[0]['id']}",
            json={"column_id": second_column["id"], "position": 99},
        ).status_code
        == 200
    )

    board = auth_client.get("/api/v1/kanban").json()
    by_column = {column["id"]: column["cards"] for column in board["columns"]}
    assert [(card["title"], card["position"]) for card in by_column[first_column["id"]]] == [
        ("C", 0),
        ("B", 1),
    ]
    assert [card["position"] for card in by_column[second_column["id"]]] == [0]


def test_workspace_deletion_refuses_to_cascade_externally_delegated_cards(auth_client):
    source_id = workspace_id(auth_client)
    destination_id = auth_client.post(
        "/api/v1/workspaces", json={"name": "Deletion target"}
    ).json()["id"]
    column = auth_client.post(
        f"/api/v1/workspaces/{source_id}/kanban/columns", json={"title": "External"}
    ).json()
    assert (
        auth_client.post(
            "/api/v1/kanban/cards",
            json={
                "column_id": column["id"],
                "workspace_id": destination_id,
                "title": "Must survive explicitly",
            },
        ).status_code
        == 201
    )

    assert auth_client.delete(f"/api/v1/workspaces/{source_id}").status_code == 204
    assert auth_client.delete(f"/api/v1/workspaces/{destination_id}").status_code == 409


def test_detailed_card_fields_nested_mutations_and_activity(auth_client):
    wid = workspace_id(auth_client)
    column = auth_client.get("/api/v1/kanban").json()["columns"][0]
    created = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": column["id"],
            "workspace_id": wid,
            "title": "Rilis rinci",
            "assignee": "Ayu",
            "priority": "urgent",
            "start_date": "2026-09-14",
            "due_date": "2026-09-20",
            "labels": ["Backend", "Rilis"],
        },
    )
    assert created.status_code == 201
    card = created.json()
    assert card["created_at"] and card["updated_at"]
    assert card["priority"] == "urgent"

    checklist = auth_client.post(
        f"/api/v1/kanban/cards/{card['id']}/checklist", json={"text": "Uji migrasi"}
    )
    assert checklist.status_code == 201
    first_id = checklist.json()["id"]
    first = auth_client.post(
        f"/api/v1/kanban/cards/{card['id']}/checklist",
        json={"text": "Langkah awal", "position": 0},
    )
    assert first.status_code == 201
    completed = auth_client.patch(
        f"/api/v1/kanban/cards/{card['id']}/checklist/{first_id}",
        json={"is_completed": True},
    )
    assert completed.json()["is_completed"] is True
    assert auth_client.post(
        f"/api/v1/kanban/cards/{card['id']}/attachments",
        json={"title": "Dokumen", "url": "https://example.com/spec"},
    ).status_code == 201
    assert auth_client.post(
        f"/api/v1/kanban/cards/{card['id']}/comments",
        json={"author": "Ayu", "body": "Siap ditinjau"},
    ).status_code == 201

    detail = auth_client.get(f"/api/v1/kanban/cards/{card['id']}").json()
    assert detail["checklist_total"] == 2
    assert detail["checklist_completed"] == 1
    assert [item["position"] for item in detail["checklist_items"]] == [0, 1]
    assert detail["attachments"][0]["url"] == "https://example.com/spec"
    assert detail["comments"][0]["body"] == "Siap ditinjau"
    assert {activity["action"] for activity in detail["activities"]} >= {
        "created", "checklist_added", "checklist_changed", "attachment_added", "comment_added"
    }


def test_nested_card_mutations_enforce_assignment_acl(app, auth_client):
    wid = workspace_id(auth_client)
    card = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": auth_client.get("/api/v1/kanban").json()["columns"][0]["id"],
            "workspace_id": wid,
            "title": "Rahasia",
        },
    ).json()
    add_user(app, email="detail-viewer@example.com", memberships=[(wid, WorkspaceRole.viewer)])
    login(auth_client, "detail-viewer@example.com")
    assert auth_client.get(f"/api/v1/kanban/cards/{card['id']}").status_code == 200
    assert auth_client.post(
        f"/api/v1/kanban/cards/{card['id']}/comments",
        json={"author": "Viewer", "body": "Tidak boleh"},
    ).status_code == 403


def test_card_rejects_invalid_date_order_and_attachment_url(auth_client):
    wid = workspace_id(auth_client)
    column_id = auth_client.get("/api/v1/kanban").json()["columns"][0]["id"]
    invalid = auth_client.post(
        "/api/v1/kanban/cards",
        json={
            "column_id": column_id,
            "workspace_id": wid,
            "title": "Tanggal salah",
            "start_date": "2026-09-20",
            "due_date": "2026-09-14",
        },
    )
    assert invalid.status_code == 422
