"use client";
import { useState, useTransition } from "react";
import { changeMemberRoleAction, removeWorkspaceMemberAction } from "@/app/actions/phase3-actions";

type Role = "OWNER" | "ADMIN" | "MEMBER";
export function TeamMemberControls({ workspaceId, member, canManage, ownerCount = 1 }: { workspaceId: string; ownerCount?: number; member: { id: string; role: Role; userId: string; name: string | null; email: string }; canManage: boolean }) {
  const [role, setRole] = useState<Role>(member.role);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (!canManage) return <span className="text-xs text-slate-500">{member.role.toLowerCase()}</span>;
  return <div className="flex items-center gap-2">
    <select aria-label={`Role for ${member.email}`} value={role} onChange={e => setRole(e.target.value as Role)} className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-700">
      <option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Member</option>
    </select>
    <button disabled={pending || role === member.role} onClick={() => startTransition(async () => { const r = await changeMemberRoleAction(workspaceId, { memberId: member.id, role }); setMessage(r.ok ? "Saved" : r.error.message); })} className="text-xs font-semibold text-indigo-600 disabled:opacity-40">Save</button>
    <button disabled={pending || (member.role === "OWNER" && ownerCount <= 1)} onClick={() => { if (confirm(`Remove ${member.email} from this workspace?`)) startTransition(async () => { const r = await removeWorkspaceMemberAction(workspaceId, { memberId: member.id }); setMessage(r.ok ? "Removed — refresh to update the list" : r.error.message); }); }} className="text-xs font-semibold text-red-600 disabled:opacity-40">Remove</button>
    {message ? <span role="status" className="max-w-36 text-xs text-slate-500">{message}</span> : null}
  </div>;
}
