import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillsStudio } from "@/components/skills-studio";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);

const workspace = {
  id: 1,
  name: "PT BISA AI",
  slug: "bisa-ai",
  workspace_type: "company" as const,
  role: "owner" as const,
  modules: [],
};
const skill = {
  id: 4,
  workspace_id: 1,
  name: "Riset Ringkas",
  slug: "riset-ringkas",
  description: "Cari fakta penting",
  instructions: "Baca sumber dan tulis bukti.",
  is_enabled: true,
};

describe("SkillsStudio", () => {
  beforeEach(() => apiMock.mockReset());

  it("traps editor focus and restores the trigger after Escape", async () => {
    apiMock.mockResolvedValue([]);
    render(<SkillsStudio workspace={workspace} />);

    const trigger = await screen.findByRole("button", { name: "Skill baru" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByLabelText("Nama skill")).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("restores the orchestration trigger after Escape", async () => {
    apiMock.mockImplementation(async (path) =>
      path === "/workspaces/1/skills" ? [skill] : [],
    );
    render(<SkillsStudio workspace={workspace} />);

    const trigger = await screen.findByRole("button", { name: "Rangkaian baru" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByLabelText("Nama rangkaian")).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows a retryable error when the studio cannot load", async () => {
    apiMock.mockRejectedValue(new Error("Koneksi terputus"));
    render(<SkillsStudio workspace={workspace} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Koneksi terputus");
    apiMock.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(4));
  });

  it("creates an editable workspace skill", async () => {
    apiMock.mockImplementation(async (path, init) => {
      if (init?.method === "POST") return skill;
      return [];
    });
    render(<SkillsStudio workspace={workspace} />);

    await screen.findByText("Skills pribadi");
    fireEvent.click(screen.getByRole("button", { name: "Skill baru" }));
    fireEvent.change(screen.getByLabelText("Nama skill"), { target: { value: "Riset Ringkas" } });
    fireEvent.change(screen.getByLabelText("Instruksi"), { target: { value: "Baca sumber dan tulis bukti." } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan skill" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/1/skills", {
      method: "POST",
      body: JSON.stringify({
        name: "Riset Ringkas",
        description: "",
        instructions: "Baca sumber dan tulis bukti.",
        is_enabled: true,
      }),
    }));
    expect(await screen.findByText("Riset Ringkas")).toBeInTheDocument();
  });

  it("saves skills as an ordered orchestration", async () => {
    const editor = { ...skill, id: 5, name: "Editor", slug: "editor" };
    const saved = {
      id: 7,
      workspace_id: 1,
      name: "Brief Mingguan",
      description: "Riset lalu edit",
      steps: [
        { position: 0, skill },
        { position: 1, skill: editor },
      ],
    };
    apiMock.mockImplementation(async (path, init) => {
      if (path === "/workspaces/1/skills") return [skill, editor];
      if (init?.method === "POST") return saved;
      return [];
    });
    render(<SkillsStudio workspace={workspace} />);

    await screen.findByText("Riset Ringkas");
    fireEvent.click(screen.getByRole("button", { name: "Rangkaian baru" }));
    fireEvent.change(screen.getByLabelText("Nama rangkaian"), { target: { value: "Brief Mingguan" } });
    fireEvent.click(screen.getByLabelText("Riset Ringkas"));
    fireEvent.click(screen.getByLabelText("Editor"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan rangkaian" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/1/orchestrations", {
      method: "POST",
      body: JSON.stringify({ name: "Brief Mingguan", description: "", skill_ids: [4, 5] }),
    }));
    expect(await screen.findByText("Brief Mingguan")).toBeInTheDocument();
  });
});
