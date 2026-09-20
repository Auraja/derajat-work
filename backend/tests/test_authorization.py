from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.models import User, Workspace, WorkspaceMember, WorkspaceRole


def _workspace_id(app) -> int:
    with app.state.session_factory() as session:
        return session.scalar(select(Workspace.id).where(Workspace.slug == "bisa-ai"))


def _create_viewer(app) -> None:
    with app.state.session_factory() as session:
        workspace_id = session.scalar(select(Workspace.id).where(Workspace.slug == "bisa-ai"))
        viewer = User(
            email="viewer@example.com",
            password_hash=hash_password("viewer-password"),
            name="Read Only",
            is_admin=False,
        )
        session.add(viewer)
        session.flush()
        session.add(
            WorkspaceMember(
                workspace_id=workspace_id,
                user_id=viewer.id,
                role=WorkspaceRole.viewer,
            )
        )
        session.commit()


def _login_viewer(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "viewer@example.com", "password": "viewer-password"},
    )
    assert response.status_code == 200


def _create_unscoped_admin(app) -> None:
    with app.state.session_factory() as session:
        session.add(
            User(
                email="platform-admin@example.com",
                password_hash=hash_password("platform-admin-password"),
                name="Platform Admin",
                is_admin=True,
            )
        )
        session.commit()


def test_viewer_can_read_workspace_resources_but_cannot_mutate(app, auth_client):
    workspace_id = _workspace_id(app)
    material = auth_client.post(
        "/api/v1/materials",
        json={
            "workspace_id": workspace_id,
            "title": "Protected material",
            "material_type": "document",
        },
    ).json()
    teaching_session = auth_client.post(
        f"/api/v1/workspaces/{workspace_id}/teaching/sessions",
        json={"title": "Protected session"},
    ).json()
    template = auth_client.post(
        "/api/v1/templates",
        json={
            "workspace_id": workspace_id,
            "name": "Protected template",
            "template_type": "teaching_session",
            "config_json": {},
        },
    ).json()
    _create_viewer(app)
    _login_viewer(auth_client)

    assert auth_client.get(f"/api/v1/materials/{material['id']}").status_code == 200
    assert auth_client.get(f"/api/v1/teaching/sessions/{teaching_session['id']}").status_code == 200
    assert auth_client.get(f"/api/v1/templates/{template['id']}").status_code == 200

    assert (
        auth_client.post(
            "/api/v1/materials",
            json={"workspace_id": workspace_id, "title": "Denied", "material_type": "document"},
        ).status_code
        == 403
    )
    assert (
        auth_client.patch(
            f"/api/v1/materials/{material['id']}", json={"title": "Denied"}
        ).status_code
        == 403
    )
    assert auth_client.delete(f"/api/v1/materials/{material['id']}").status_code == 403

    assert (
        auth_client.post(
            f"/api/v1/workspaces/{workspace_id}/teaching/sessions", json={"title": "Denied"}
        ).status_code
        == 403
    )
    assert (
        auth_client.patch(
            f"/api/v1/teaching/sessions/{teaching_session['id']}", json={"title": "Denied"}
        ).status_code
        == 403
    )
    assert (
        auth_client.delete(f"/api/v1/teaching/sessions/{teaching_session['id']}").status_code == 403
    )

    assert (
        auth_client.post(
            "/api/v1/templates",
            json={
                "workspace_id": workspace_id,
                "name": "Denied",
                "template_type": "teaching_session",
                "config_json": {},
            },
        ).status_code
        == 403
    )
    assert (
        auth_client.patch(
            f"/api/v1/templates/{template['id']}", json={"name": "Denied"}
        ).status_code
        == 403
    )
    assert auth_client.delete(f"/api/v1/templates/{template['id']}").status_code == 403


def test_only_admin_can_mutate_global_templates(app, auth_client):
    global_template = auth_client.post(
        "/api/v1/templates",
        json={
            "workspace_id": None,
            "name": "Global template",
            "template_type": "teaching_session",
            "config_json": {},
        },
    ).json()
    _create_viewer(app)
    _login_viewer(auth_client)

    assert auth_client.get(f"/api/v1/templates/{global_template['id']}").status_code == 200
    assert (
        auth_client.post(
            "/api/v1/templates",
            json={
                "workspace_id": None,
                "name": "Denied global",
                "template_type": "teaching_session",
                "config_json": {},
            },
        ).status_code
        == 403
    )
    assert (
        auth_client.patch(
            f"/api/v1/templates/{global_template['id']}", json={"name": "Denied"}
        ).status_code
        == 403
    )
    assert auth_client.delete(f"/api/v1/templates/{global_template['id']}").status_code == 403


def test_viewer_cannot_update_or_delete_workspace(app, auth_client):
    workspace_id = _workspace_id(app)
    _create_viewer(app)
    _login_viewer(auth_client)

    assert (
        auth_client.patch(f"/api/v1/workspaces/{workspace_id}", json={"name": "Denied"}).status_code
        == 403
    )
    assert auth_client.delete(f"/api/v1/workspaces/{workspace_id}").status_code == 403


def test_platform_admin_without_membership_cannot_bypass_workspace_scope(app, auth_client):
    workspace_id = _workspace_id(app)
    _create_unscoped_admin(app)
    response = auth_client.post(
        "/api/v1/auth/login",
        json={
            "email": "platform-admin@example.com",
            "password": "platform-admin-password",
        },
    )
    assert response.status_code == 200

    assert auth_client.get("/api/v1/workspaces").json() == []
    assert auth_client.get(f"/api/v1/workspaces/{workspace_id}").status_code == 404
    assert (
        auth_client.post(
            f"/api/v1/workspaces/{workspace_id}/skills",
            json={"name": "Denied", "instructions": "Denied"},
        ).status_code
        == 404
    )
