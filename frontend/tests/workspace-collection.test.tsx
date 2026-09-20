import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCollection } from "@/components/workspace-collection";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);

const workspace = {
  id: 9,
  name: "Studio Lama",
  slug: "studio-lama",
  description: "Catatan lama",
  workspace_type: "personal" as const,
  role: "owner" as const,
  modules: [],
};

describe("WorkspaceCollection", () => {
  beforeEach(() => apiMock.mockReset());

  it("traps focus in the create dialog and restores the trigger after backdrop close", () => {
    const onChange = vi.fn();
    render(<WorkspaceCollection workspaces={[]} onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Ruang baru" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Ruang baru" });
    const nameInput = screen.getByLabelText("Nama ruang");
    const closeButton = screen.getByRole("button", { name: "Tutup" });
    const saveButton = screen.getByRole("button", { name: "Simpan ruang" });
    expect(nameInput).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    const inertBackground = trigger.closest<HTMLElement>("[inert]");
    expect(inertBackground).not.toBeNull();
    expect(inertBackground).toHaveAttribute("aria-hidden", "true");

    fireEvent.change(nameInput, { target: { value: "Studio Baru" } });
    saveButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();

    fireEvent.mouseDown(dialog.parentElement!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
    expect(inertBackground).not.toHaveAttribute("inert");
    expect(inertBackground).not.toHaveAttribute("aria-hidden");
  });

  it("focuses the edit form and restores its trigger after Escape", () => {
    const onChange = vi.fn();
    render(<WorkspaceCollection workspaces={[workspace]} onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Edit Studio Lama" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Edit ruang" });
    expect(screen.getByLabelText("Nama ruang")).toHaveFocus();
    expect(screen.getByLabelText("Nama ruang")).toHaveValue("Studio Lama");

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("creates a personal workspace from the dashboard", async () => {
    const onChange = vi.fn();
    apiMock.mockResolvedValue({ ...workspace, name: "Studio Pribadi", slug: "studio-pribadi" });
    render(<WorkspaceCollection workspaces={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Ruang baru" }));
    fireEvent.change(screen.getByLabelText("Nama ruang"), { target: { value: "Studio Pribadi" } });
    fireEvent.change(screen.getByLabelText("Deskripsi"), { target: { value: "Untuk karya pilihan" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan ruang" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces", {
      method: "POST",
      body: JSON.stringify({
        name: "Studio Pribadi",
        description: "Untuk karya pilihan",
        workspace_type: "personal",
      }),
    }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Studio Pribadi" }), "created");
  });

  it("edits and removes an owned workspace", async () => {
    const onChange = vi.fn();
    apiMock.mockResolvedValueOnce({ ...workspace, name: "Studio Baru", slug: "studio-baru" }).mockResolvedValueOnce(undefined);
    render(<WorkspaceCollection workspaces={[workspace]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Studio Lama" }));
    fireEvent.change(screen.getByLabelText("Nama ruang"), { target: { value: "Studio Baru" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/9", expect.objectContaining({ method: "PATCH" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Hapus Studio Lama" }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus ruang" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/9", { method: "DELETE" }));
    expect(onChange).toHaveBeenCalledWith(workspace, "deleted");
  });
});
