export type CardPriority = "low" | "medium" | "high" | "urgent";
export type ChecklistItem = { id: number; text: string; is_completed: boolean; position: number; created_at: string; updated_at: string };
export type Attachment = { id: number; title: string; url: string; created_at: string; updated_at: string };
export type Comment = { id: number; author: string; body: string; created_at: string; updated_at: string };
export type CardActivity = { id: number; actor: string; action: string; detail: string; created_at: string };
export type KanbanCard = {
  id: number; column_id: number; workspace_id: number; title: string; description: string | null;
  assignee: string | null; priority: CardPriority; due_date: string | null; start_date: string | null;
  labels: string[]; position: number; checklist_total: number; checklist_completed: number;
  archived_at: string | null;
  created_at: string; updated_at: string;
};
export type KanbanCardDetail = KanbanCard & {
  checklist_items: ChecklistItem[]; attachments: Attachment[]; comments: Comment[]; activities: CardActivity[];
};
export type BoardWorkspace = { id: number; name: string; slug: string; role: string; can_write: boolean };
export type KanbanColumn = { id: number; workspace_id: null; title: string; position: number; can_write: boolean; can_create: boolean; can_move_into: boolean; cards: KanbanCard[] };
export type KanbanBoard = { workspaces: BoardWorkspace[]; columns: KanbanColumn[]; archived_cards: KanbanCard[] };

export function moveCardInBoard(board: KanbanBoard, cardId: number, targetColumnId: number, targetPosition: number): KanbanBoard {
  const moving = board.columns.flatMap((column) => column.cards).find((card) => card.id === cardId);
  if (!moving || !board.columns.some((column) => column.id === targetColumnId)) return board;

  const columns = board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => card.id !== cardId).map((card, position) => ({ ...card, position })),
  }));
  const target = columns.find((column) => column.id === targetColumnId)!;
  target.cards.splice(Math.max(0, Math.min(targetPosition, target.cards.length)), 0, { ...moving, column_id: targetColumnId });
  target.cards = target.cards.map((card, position) => ({ ...card, position }));
  return { ...board, columns };
}
