from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_workspace_access
from app.core.database import get_db
from app.models import (
    KanbanActivity,
    KanbanAttachment,
    KanbanCard,
    KanbanChecklistItem,
    KanbanColumn,
    KanbanComment,
    User,
    WorkspaceMember,
    WorkspaceRole,
)
from app.schemas.kanban import (
    AttachmentCreate,
    AttachmentRead,
    BoardRead,
    CardCreate,
    CardDetailRead,
    CardRead,
    CardUpdate,
    ChecklistCreate,
    ChecklistRead,
    ChecklistUpdate,
    ColumnCreate,
    ColumnRead,
    ColumnUpdate,
    CommentCreate,
    CommentRead,
    GlobalBoardRead,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/kanban", tags=["kanban"])
global_router = APIRouter(prefix="/kanban", tags=["kanban"])
WRITE_ROLES = {WorkspaceRole.owner, WorkspaceRole.admin}
CANONICAL_STATUSES = (
    ("backlog", "Backlog"),
    ("to_do", "To Do"),
    ("in_progress", "In Progress"),
    ("review", "Review"),
    ("done", "Done"),
)


def canonical_key(title: str) -> str:
    value = " ".join(title.casefold().replace("_", " ").replace("-", " ").split())
    aliases = {
        "to_do": {"to do", "todo", "masuk", "akan dikerjakan", "daftar tugas", "rencana"},
        "in_progress": {"in progress", "doing", "dikerjakan", "sedang dikerjakan", "proses"},
        "review": {"review", "qa", "quality assurance", "ditinjau", "peninjauan"},
        "done": {"done", "selesai", "completed", "complete", "rampung"},
        "backlog": {"backlog", "icebox", "ide", "ideas"},
    }
    return next((key for key, titles in aliases.items() if value in titles), "backlog")


def canonical_columns(session: Session) -> list[KanbanColumn]:
    columns = list(
        session.scalars(
            select(KanbanColumn)
            .where(KanbanColumn.status_key.is_not(None))
            .options(selectinload(KanbanColumn.cards))
            .order_by(KanbanColumn.position)
        ).all()
    )
    existing = {column.status_key for column in columns}
    if len(columns) != len(CANONICAL_STATUSES):
        for position, (key, title) in enumerate(CANONICAL_STATUSES):
            if key not in existing:
                session.add(
                    KanbanColumn(workspace_id=None, status_key=key, title=title, position=position)
                )
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        columns = list(
            session.scalars(
                select(KanbanColumn)
                .where(KanbanColumn.status_key.is_not(None))
                .options(selectinload(KanbanColumn.cards))
                .order_by(KanbanColumn.position)
            ).all()
        )
    return columns


def canonical_column(session: Session, column_id: int) -> KanbanColumn:
    column = session.scalar(
        select(KanbanColumn).where(
            KanbanColumn.id == column_id, KanbanColumn.status_key.is_not(None)
        )
    )
    if column is None:
        raise HTTPException(404, "Status tidak ditemukan")
    return column


def ordered_cards(session: Session, column_id: int, *, exclude_id: int | None = None):
    query = select(KanbanCard).where(
        KanbanCard.column_id == column_id, KanbanCard.archived_at.is_(None)
    )
    if exclude_id is not None:
        query = query.where(KanbanCard.id != exclude_id)
    return list(session.scalars(query.order_by(KanbanCard.position, KanbanCard.id)).all())


def normalize_column(session: Session, column_id: int, *, exclude_id: int | None = None) -> None:
    cards = ordered_cards(session, column_id, exclude_id=exclude_id)
    for card in cards:
        card.position = -card.id
    session.flush()
    for position, card in enumerate(cards):
        card.position = position


def place_card(session: Session, card: KanbanCard, column_id: int, position: int) -> None:
    old_column_id = card.column_id
    target_cards = ordered_cards(session, column_id, exclude_id=card.id)
    source_cards = (
        ordered_cards(session, old_column_id, exclude_id=card.id)
        if old_column_id != column_id
        else []
    )
    target_cards.insert(min(position, len(target_cards)), card)
    for item in {*target_cards, *source_cards}:
        item.position = -item.id
    session.flush()
    card.column_id = column_id
    for index, item in enumerate(target_cards):
        item.position = index
    for index, item in enumerate(source_cards):
        item.position = index


def accessible_memberships(session: Session, user: User) -> list[WorkspaceMember]:
    return list(
        session.scalars(
            select(WorkspaceMember)
            .where(WorkspaceMember.user_id == user.id)
            .options(selectinload(WorkspaceMember.workspace))
        ).all()
    )


def visible_board(
    session: Session, memberships: list[WorkspaceMember], workspace_filter: int | None = None
):
    workspace_ids = {item.workspace_id for item in memberships}
    if workspace_filter is not None:
        workspace_ids &= {workspace_filter}
    writable = any(item.role in WRITE_ROLES for item in memberships)
    return [
        {
            "id": column.id,
            "workspace_id": None,
            "title": column.title,
            "position": column.position,
            "cards": [
                card
                for card in column.cards
                if card.workspace_id in workspace_ids and card.archived_at is None
            ],
            "can_write": writable,
            "can_create": writable,
            "can_move_into": writable,
        }
        for column in canonical_columns(session)
    ]


@global_router.get("", response_model=GlobalBoardRead)
def global_board(user: User = Depends(get_current_user), session: Session = Depends(get_db)):
    memberships = accessible_memberships(session, user)
    workspace_ids = {item.workspace_id for item in memberships}
    return {
        "columns": visible_board(session, memberships),
        "workspaces": [
            {
                "id": item.workspace.id,
                "name": item.workspace.name,
                "slug": item.workspace.slug,
                "role": item.role.value,
                "can_write": item.role in WRITE_ROLES,
            }
            for item in memberships
        ],
        "archived_cards": list(
            session.scalars(
                select(KanbanCard)
                .where(
                    KanbanCard.archived_at.is_not(None),
                    KanbanCard.workspace_id.in_(workspace_ids),
                )
                .order_by(KanbanCard.archived_at.desc(), KanbanCard.id.desc())
            ).all()
        ),
    }


@router.get("", response_model=BoardRead)
def board(
    workspace_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    require_workspace_access(session, workspace_id, user)
    memberships = accessible_memberships(session, user)
    columns = visible_board(session, memberships, workspace_id)
    return {
        "columns": [
            {
                key: value
                for key, value in column.items()
                if key not in {"can_write", "can_create", "can_move_into"}
            }
            for column in columns
        ]
    }


@router.post("/columns", response_model=ColumnRead, status_code=201)
def create_column(
    workspace_id: int,
    payload: ColumnCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    require_workspace_access(session, workspace_id, user, write=True)
    columns = canonical_columns(session)
    key = canonical_key(payload.title)
    return next(column for column in columns if column.status_key == key)


@router.patch("/columns/{column_id}", response_model=ColumnRead)
def update_column(
    workspace_id: int,
    column_id: int,
    payload: ColumnUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    require_workspace_access(session, workspace_id, user, write=True)
    del payload
    return canonical_column(session, column_id)


@router.delete("/columns/{column_id}", status_code=204)
def delete_column(
    workspace_id: int,
    column_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    require_workspace_access(session, workspace_id, user, write=True)
    column = canonical_column(session, column_id)
    if any(card.workspace_id == workspace_id for card in column.cards):
        raise HTTPException(409, "Status masih memiliki kartu pada PT ini")
    return Response(status_code=204)


def create_assigned_card(payload: CardCreate, assignment_id: int, user: User, session: Session):
    require_workspace_access(session, assignment_id, user, write=True)
    canonical_column(session, payload.column_id)
    position = len(ordered_cards(session, payload.column_id))
    card_values = payload.model_dump(exclude={"column_id", "workspace_id"})
    card = KanbanCard(
        column_id=payload.column_id,
        workspace_id=assignment_id,
        position=position,
        **card_values,
    )
    session.add(card)
    session.flush()
    session.add(
        KanbanActivity(card_id=card.id, actor=user.name, action="created", detail="Kartu dibuat")
    )
    session.commit()
    session.refresh(card)
    return card


@router.post("/cards", response_model=CardRead, status_code=201)
def create_card(
    workspace_id: int,
    payload: CardCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return create_assigned_card(payload, workspace_id, user, session)


@global_router.post("/cards", response_model=CardRead, status_code=201)
def create_global_card(
    payload: CardCreate, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    if payload.workspace_id is None:
        raise HTTPException(422, "workspace_id wajib diisi")
    return create_assigned_card(payload, payload.workspace_id, user, session)


def editable_card(
    session: Session, card_id: int, user: User, workspace_id: int | None = None
) -> KanbanCard:
    card = session.get(KanbanCard, card_id)
    if card is None or (workspace_id is not None and card.workspace_id != workspace_id):
        raise HTTPException(404, "Kartu tidak ditemukan")
    require_workspace_access(session, card.workspace_id, user, write=True)
    return card


def apply_card_update(card: KanbanCard, payload: CardUpdate, user: User, session: Session):
    updates = payload.model_dump(exclude_unset=True)
    destination = updates.get("workspace_id", card.workspace_id)
    require_workspace_access(session, destination, user, write=True)
    start_date = updates.get("start_date", card.start_date)
    due_date = updates.get("due_date", card.due_date)
    if start_date and due_date and start_date > due_date:
        raise HTTPException(422, "start_date tidak boleh setelah due_date")
    actions = []
    if destination != card.workspace_id:
        actions.append(("delegated", "Penugasan PT diubah"))
    if "column_id" in updates or "position" in updates:
        target_column_id = updates.pop("column_id", card.column_id)
        canonical_column(session, target_column_id)
        target_position = updates.pop(
            "position", len(ordered_cards(session, target_column_id, exclude_id=card.id))
        )
        if target_column_id != card.column_id:
            actions.append(("moved", "Status kartu diubah"))
        else:
            actions.append(("reordered", "Urutan kartu diubah"))
        place_card(session, card, target_column_id, target_position)
    changed = [key for key, value in updates.items() if getattr(card, key) != value]
    for key, value in updates.items():
        setattr(card, key, value)
    if changed:
        actions.append(("edited", "Bidang diubah: " + ", ".join(changed)))
    for action, detail in actions:
        session.add(KanbanActivity(card_id=card.id, actor=user.name, action=action, detail=detail))
    session.commit()
    session.refresh(card)
    return card


@router.patch("/cards/{card_id}", response_model=CardRead)
def update_card(
    workspace_id: int,
    card_id: int,
    payload: CardUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return apply_card_update(
        editable_card(session, card_id, user, workspace_id), payload, user, session
    )


@global_router.patch("/cards/{card_id}", response_model=CardRead)
def update_global_card(
    card_id: int,
    payload: CardUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return apply_card_update(editable_card(session, card_id, user), payload, user, session)


@global_router.post("/cards/{card_id}/archive", response_model=CardRead)
def archive_global_card(
    card_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    card = editable_card(session, card_id, user)
    column = canonical_column(session, card.column_id)
    if column.status_key != "done":
        raise HTTPException(409, "Hanya tugas Done yang dapat diarsipkan")
    if card.archived_at is None:
        card.archived_at = datetime.now(UTC)
        card.position = -card.id
        session.flush()
        normalize_column(session, card.column_id)
        add_activity(session, card, user, "archived", "Kartu diarsipkan")
        session.commit()
        session.refresh(card)
    return card


@global_router.post("/cards/{card_id}/restore", response_model=CardRead)
def restore_global_card(
    card_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    card = editable_card(session, card_id, user)
    if card.archived_at is not None:
        card.archived_at = None
        place_card(session, card, card.column_id, len(ordered_cards(session, card.column_id)))
        add_activity(session, card, user, "restored", "Kartu dipulihkan dari arsip")
        session.commit()
        session.refresh(card)
    return card


def remove_card(card: KanbanCard, session: Session):
    old_column_id = card.column_id
    session.delete(card)
    normalize_column(session, old_column_id, exclude_id=card.id)
    session.commit()
    return Response(status_code=204)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    workspace_id: int,
    card_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return remove_card(editable_card(session, card_id, user, workspace_id), session)


@global_router.delete("/cards/{card_id}", status_code=204)
def delete_global_card(
    card_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    return remove_card(editable_card(session, card_id, user), session)


def readable_card(session: Session, card_id: int, user: User) -> KanbanCard:
    card = session.scalar(
        select(KanbanCard)
        .where(KanbanCard.id == card_id)
        .options(
            selectinload(KanbanCard.checklist_items),
            selectinload(KanbanCard.attachments),
            selectinload(KanbanCard.comments),
            selectinload(KanbanCard.activities),
        )
    )
    if card is None:
        raise HTTPException(404, "Kartu tidak ditemukan")
    require_workspace_access(session, card.workspace_id, user)
    return card


def add_activity(session: Session, card: KanbanCard, user: User, action: str, detail: str):
    session.add(KanbanActivity(card_id=card.id, actor=user.name, action=action, detail=detail))


@global_router.get("/cards/{card_id}", response_model=CardDetailRead)
def card_detail(
    card_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    return readable_card(session, card_id, user)


@global_router.post("/cards/{card_id}/checklist", response_model=ChecklistRead, status_code=201)
def create_checklist_item(
    card_id: int,
    payload: ChecklistCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    items = list(
        session.scalars(
            select(KanbanChecklistItem)
            .where(KanbanChecklistItem.card_id == card.id)
            .order_by(KanbanChecklistItem.position)
        ).all()
    )
    position = min(payload.position if payload.position is not None else len(items), len(items))
    for value in items:
        value.position = -value.id
    session.flush()
    item = KanbanChecklistItem(card_id=card.id, text=payload.text, position=position)
    items.insert(position, item)
    session.add(item)
    session.flush()
    for index, value in enumerate(items):
        value.position = index
    add_activity(session, card, user, "checklist_added", f"Checklist ditambah: {payload.text}")
    session.commit()
    session.refresh(item)
    return item


def checklist_item(session: Session, card: KanbanCard, item_id: int) -> KanbanChecklistItem:
    item = session.get(KanbanChecklistItem, item_id)
    if item is None or item.card_id != card.id:
        raise HTTPException(404, "Checklist tidak ditemukan")
    return item


@global_router.patch("/cards/{card_id}/checklist/{item_id}", response_model=ChecklistRead)
def update_checklist_item(
    card_id: int,
    item_id: int,
    payload: ChecklistUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    item = checklist_item(session, card, item_id)
    updates = payload.model_dump(exclude_unset=True)
    if "position" in updates:
        target = updates.pop("position")
        items = list(
            session.scalars(
                select(KanbanChecklistItem)
                .where(KanbanChecklistItem.card_id == card.id, KanbanChecklistItem.id != item.id)
                .order_by(KanbanChecklistItem.position)
            ).all()
        )
        items.insert(min(target, len(items)), item)
        for value in items:
            value.position = -value.id
        session.flush()
        for position, value in enumerate(items):
            value.position = position
    for key, value in updates.items():
        setattr(item, key, value)
    add_activity(session, card, user, "checklist_changed", f"Checklist diubah: {item.text}")
    session.commit()
    session.refresh(item)
    return item


@global_router.delete("/cards/{card_id}/checklist/{item_id}", status_code=204)
def delete_checklist_item(
    card_id: int,
    item_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    item = checklist_item(session, card, item_id)
    text = item.text
    session.delete(item)
    session.flush()
    items = list(
        session.scalars(
            select(KanbanChecklistItem)
            .where(KanbanChecklistItem.card_id == card.id)
            .order_by(KanbanChecklistItem.position)
        ).all()
    )
    for position, value in enumerate(items):
        value.position = position
    add_activity(session, card, user, "checklist_removed", f"Checklist dihapus: {text}")
    session.commit()
    return Response(status_code=204)


@global_router.post("/cards/{card_id}/attachments", response_model=AttachmentRead, status_code=201)
def create_attachment(
    card_id: int,
    payload: AttachmentCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    attachment = KanbanAttachment(card_id=card.id, title=payload.title, url=str(payload.url))
    session.add(attachment)
    add_activity(session, card, user, "attachment_added", f"Lampiran ditambah: {payload.title}")
    session.commit()
    session.refresh(attachment)
    return attachment


@global_router.delete("/cards/{card_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    card_id: int,
    attachment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    attachment = session.get(KanbanAttachment, attachment_id)
    if attachment is None or attachment.card_id != card.id:
        raise HTTPException(404, "Lampiran tidak ditemukan")
    add_activity(session, card, user, "attachment_removed", f"Lampiran dihapus: {attachment.title}")
    session.delete(attachment)
    session.commit()
    return Response(status_code=204)


@global_router.post("/cards/{card_id}/comments", response_model=CommentRead, status_code=201)
def create_comment(
    card_id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    comment = KanbanComment(card_id=card.id, author=payload.author, body=payload.body)
    session.add(comment)
    add_activity(session, card, user, "comment_added", f"Komentar ditambah oleh {payload.author}")
    session.commit()
    session.refresh(comment)
    return comment


@global_router.delete("/cards/{card_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    card_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    card = editable_card(session, card_id, user)
    comment = session.get(KanbanComment, comment_id)
    if comment is None or comment.card_id != card.id:
        raise HTTPException(404, "Komentar tidak ditemukan")
    add_activity(session, card, user, "comment_removed", f"Komentar {comment.author} dihapus")
    session.delete(comment)
    session.commit()
    return Response(status_code=204)
