import { describe, expect, it } from "vitest";

import { moveCardInBoard, type KanbanBoard } from "@/lib/kanban";

const board: KanbanBoard = {
  workspaces: [],
  archived_cards: [],
  columns: [
    {
      id: 1,
      workspace_id: null,
      title: "To Do",
      position: 0,
      can_write: true,
      can_create: true,
      can_move_into: true,
      cards: [
        { id: 10, column_id: 1, workspace_id: 1, title: "Satu", description: null, assignee: null, priority: "medium", due_date: null, start_date: null, labels: [], position: 0, checklist_total: 0, checklist_completed: 0, archived_at: null, created_at: "", updated_at: "" },
        { id: 11, column_id: 1, workspace_id: 1, title: "Dua", description: null, assignee: null, priority: "medium", due_date: null, start_date: null, labels: [], position: 1, checklist_total: 0, checklist_completed: 0, archived_at: null, created_at: "", updated_at: "" },
      ],
    },
    {
      id: 2,
      workspace_id: null,
      title: "In Progress",
      position: 1,
      can_write: true,
      can_create: true,
      can_move_into: true,
      cards: [],
    },
  ],
};

describe("optimistic Kanban movement", () => {
  it("moves and renumbers a card before the server reload completes", () => {
    const moved = moveCardInBoard(board, 10, 2, 0);

    expect(moved.columns[0].cards.map((card) => [card.id, card.position])).toEqual([[11, 0]]);
    expect(moved.columns[1].cards.map((card) => [card.id, card.column_id, card.position])).toEqual([[10, 2, 0]]);
    expect(board.columns[0].cards).toHaveLength(2);
  });
});
