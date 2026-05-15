import React, { useState } from 'react';
import { Trash2, Plus, CheckSquare, MessageSquare, Calendar, Tag, User, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const LABEL_OPTIONS = ['Hitno', 'Bug', 'Feature', 'Design', 'Ostalo'];
const EPIC_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

export default function TaskDetailModal({ task, users = [], onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    start_date: task.start_date ? task.start_date.slice(0, 10) : '',
    due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    labels: [...(task.labels || [])],
    assigned_users: [...(task.assigned_users || [])],
    card_color: task.card_color || '',
    epic_title: task.epic_title || '',
    checklists: (task.checklists || []).map(c => ({ ...c })),
    comments: [...(task.comments || [])],
  });
  const [newChecklist, setNewChecklist] = useState('');
  const [newComment, setNewComment] = useState('');

  const toggleLabel = (label) => {
    setForm(prev => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels.filter(l => l !== label)
        : [...prev.labels, label],
    }));
  };

  const toggleAssignee = (email) => {
    setForm(prev => ({
      ...prev,
      assigned_users: prev.assigned_users.includes(email)
        ? prev.assigned_users.filter(e => e !== email)
        : [...prev.assigned_users, email],
    }));
  };

  const addChecklistItem = () => {
    if (!newChecklist.trim()) return;
    setForm(prev => ({
      ...prev,
      checklists: [...prev.checklists, { text: newChecklist.trim(), done: false }],
    }));
    setNewChecklist('');
  };

  const toggleChecklist = (index) => {
    setForm(prev => ({
      ...prev,
      checklists: prev.checklists.map((c, i) =>
        i === index ? { ...c, done: !c.done } : c
      ),
    }));
  };

  const removeChecklist = (index) => {
    setForm(prev => ({
      ...prev,
      checklists: prev.checklists.filter((_, i) => i !== index),
    }));
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    setForm(prev => ({
      ...prev,
      comments: [
        ...prev.comments,
        { text: newComment.trim(), author: '', created_at: new Date().toISOString() },
      ],
    }));
    setNewComment('');
  };

  const handleSave = () => {
    onSave({
      title: form.title,
      description: form.description || undefined,
      start_date: form.start_date || undefined,
      due_date: form.due_date || undefined,
      labels: form.labels,
      assigned_users: form.assigned_users,
      card_color: form.card_color || undefined,
      epic_title: form.epic_title || undefined,
      checklists: form.checklists,
      comments: form.comments,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-slate-200">
          <DialogTitle>Detalji zadatka</DialogTitle>
        </DialogHeader>

        <ModalScrollArea>
          <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-2">
              <Label htmlFor="task-title">Naslov</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc">Opis</Label>
              <textarea
                id="task-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Početak
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-date" className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Rok
                </Label>
                <Input
                  id="due-date"
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            <LabelsSection form={form} toggleLabel={toggleLabel} />

            {users.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Dodeljeni korisnici
                </Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                      <Checkbox
                        checked={form.assigned_users.includes(u.email)}
                        onCheckedChange={() => toggleAssignee(u.email)}
                      />
                      <span>{u.full_name || u.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <EpicSection form={form} setForm={setForm} />

            <ChecklistSection
              form={form}
              newChecklist={newChecklist}
              setNewChecklist={setNewChecklist}
              toggleChecklist={toggleChecklist}
              removeChecklist={removeChecklist}
              addChecklistItem={addChecklistItem}
            />

            <CommentsSection
              form={form}
              newComment={newComment}
              setNewComment={setNewComment}
              addComment={addComment}
            />
          </div>
        </ModalScrollArea>

        <DialogFooter className="px-5 py-4 border-t border-slate-200 flex-row justify-between sm:justify-between">
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            Obriši
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Otkaži</Button>
            <Button type="button" onClick={handleSave} disabled={!form.title.trim()}>Sačuvaj</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModalScrollArea({ children }) {
  return children;
}

function LabelsSection({ form, toggleLabel }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" />
        Labele
      </Label>
      <div className="flex flex-wrap gap-2">
        {LABEL_OPTIONS.map(label => (
          <button
            key={label}
            type="button"
            onClick={() => toggleLabel(label)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              form.labels.includes(label)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EpicSection({ form, setForm }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5" />
        Epic
      </Label>
      <Input
        placeholder="Naziv epica..."
        value={form.epic_title}
        onChange={e => setForm(prev => ({ ...prev, epic_title: e.target.value }))}
      />
      <div className="flex gap-2 flex-wrap">
        {EPIC_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => setForm(prev => ({ ...prev, card_color: color }))}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              form.card_color === color ? 'border-slate-800 scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        {form.card_color && (
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, card_color: '' }))}
            className="text-xs text-slate-500 hover:text-slate-700 self-center"
          >
            Ukloni boju
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistSection({
  form,
  newChecklist,
  setNewChecklist,
  toggleChecklist,
  removeChecklist,
  addChecklistItem,
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <CheckSquare className="w-3.5 h-3.5" />
        Checklista
      </Label>
      {form.checklists.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Checkbox
            checked={!!item.done}
            onCheckedChange={() => toggleChecklist(index)}
          />
          <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-400' : ''}`}>
            {item.text}
          </span>
          <button
            type="button"
            onClick={() => removeChecklist(index)}
            className="text-slate-300 hover:text-red-400 text-xs"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Nova stavka..."
          value={newChecklist}
          onChange={e => setNewChecklist(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addChecklistItem(); }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addChecklistItem}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function CommentsSection({ form, newComment, setNewComment, addComment }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Komentari
      </Label>
      {form.comments.map((comment, index) => (
        <CommentItem key={index} comment={comment} />
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Dodaj komentar..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addComment}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function CommentItem({ comment }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
      <p className="text-slate-700">{comment.text}</p>
      {comment.created_at && (
        <p className="text-xs text-slate-400 mt-1">
          {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
        </p>
      )}
    </div>
  );
}
