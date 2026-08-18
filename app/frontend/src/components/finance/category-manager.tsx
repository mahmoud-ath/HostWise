"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import {
  useExpenseCategories,
  useRevenueCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useCreateRevenueCategory,
  useUpdateRevenueCategory,
  useDeleteRevenueCategory,
  type ExpenseCategory,
  type RevenueCategory,
} from "@/hooks/use-api";

type Tab = "expense" | "revenue";

export function CategoryManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("expense");
  const [newName, setNewName] = useState("");
  const createExp = useCreateExpenseCategory();
  const createRev = useCreateRevenueCategory();

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    if (tab === "expense") createExp.mutate({ name });
    else createRev.mutate({ name });
    setNewName("");
  };

  const creating = (tab === "expense" ? createExp : createRev).isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Categories</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 flex gap-2">
          <Button size="sm" variant={tab === "expense" ? "default" : "outline"} onClick={() => setTab("expense")}>
            Expense
          </Button>
          <Button size="sm" variant={tab === "revenue" ? "default" : "outline"} onClick={() => setTab("revenue")}>
            Revenue
          </Button>
        </div>

        <div className="mb-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New category name…"
          />
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>

        {tab === "expense" ? <ExpenseCategoryList /> : <RevenueCategoryList />}
      </div>
    </div>
  );
}

function ExpenseCategoryList() {
  const { data: cats, isLoading } = useExpenseCategories();
  const rename = useUpdateExpenseCategory();
  const del = useDeleteExpenseCategory();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const list = cats || [];

  const handleRename = (c: ExpenseCategory) => {
    const name = window.prompt("Rename category", c.name);
    if (name && name.trim()) rename.mutate({ id: c.id, data: { name: name.trim() } });
  };
  const handleDelete = (c: ExpenseCategory) => {
    if (c.is_default) {
      alert("Default categories cannot be deleted.");
      return;
    }
    if (window.confirm(`Delete "${c.name}"? Its expenses will become "Uncategorized".`)) {
      del.mutate(c.id);
    }
  };

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">No expense categories yet — add one above.</p>
      )}
      {list.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              {c.name}
              {c.is_default && <Badge variant="secondary">default</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.expense_count} expense{c.expense_count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" title="Rename" onClick={() => handleRename(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-red-500" title="Delete" onClick={() => handleDelete(c)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueCategoryList() {
  const { data: cats, isLoading } = useRevenueCategories();
  const rename = useUpdateRevenueCategory();
  const del = useDeleteRevenueCategory();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const list = cats || [];

  const handleRename = (c: RevenueCategory) => {
    const name = window.prompt("Rename category", c.name);
    if (name && name.trim()) rename.mutate({ id: c.id, data: { name: name.trim() } });
  };
  const handleDelete = (c: RevenueCategory) => {
    if (c.is_default) {
      alert("Default categories cannot be deleted.");
      return;
    }
    if (window.confirm(`Delete "${c.name}"? Its revenue will become "Uncategorized".`)) {
      del.mutate(c.id);
    }
  };

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">No revenue categories yet — add one above.</p>
      )}
      {list.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              {c.name}
              {c.is_default && <Badge variant="secondary">default</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.revenue_count} revenue{c.revenue_count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" title="Rename" onClick={() => handleRename(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-red-500" title="Delete" onClick={() => handleDelete(c)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
