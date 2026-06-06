import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Plus,
  CheckSquare,
  MessageSquare,
  Calendar,
  Tag,
  User,
  Palette,
  Paperclip,
  File as FileIcon,
  Pencil,
} from 'lucide-react';
import { api } from '@/api/client';
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

import { LABEL_OPTIONS, LABEL_COLORS } from './taskLabels';

const EPIC_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

function resolveCommentAuthorLabel(comment, users) {
  if (comment?.author_name && String(comment.author_name).trim()) return String(comment.author_name).trim();
  const email = (comment?.author || '').trim();
  if (email && Array.isArray(users)) {
    const u = users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u?.full_name) return u.full_name;
  }
  return email || 'Nepoznat autor';
}

function canUserEditComment(comment, currentUser, readOnly) {
  if (readOnly) return false;
  const role = String(currentUser?.role || '').toLowerCase();
  if (role === 'admin') return true;
  const me = (currentUser?.email || '').trim().toLowerCase();
  const author = (comment?.author || '').trim().toLowerCase();
  return Boolean(me && author && me === author);
}

export default function TaskDetailModal({
  task,
  users = [],
  currentUser = null,
  currentUserEmail = '',
  readOnly = false,
  onClose,
  onSave,
  onDelete,
}) {
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
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const orphanIdsRef = useRef(new Set());
  const [editingCommentIndex, setEditingCommentIndex] = useState(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');

  useEffect(
    () => () => {
      orphanIdsRef.current.forEach((id) => {
        api.tasks.deleteCommentFile(id).catch(() => {});
      });
    },
    [],
  );

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
    if (!newComment.trim() && !pendingAttachments.length) return;
    const email = (currentUser?.email || currentUserEmail || '').trim();
    const fromAssignable = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    const author_name = (
      currentUser?.full_name ||
      fromAssignable?.full_name ||
      email ||
      'Korisnik'
    ).trim();
    pendingAttachments.forEach((a) => orphanIdsRef.current.delete(a.id));
    const attachments = pendingAttachments.map(({ id, name, mime_type, url }) => ({
      id,
      name,
      mime_type,
      url,
    }));
    setForm((prev) => ({
      ...prev,
      comments: [
        ...prev.comments,
        {
          text: newComment.trim(),
          author: email,
          author_name,
          created_at: new Date().toISOString(),
          ...(attachments.length ? { attachments } : {}),
        },
      ],
    }));
    setNewComment('');
    setPendingAttachments([]);
  };

  const onPickCommentFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploadMsg('');
    for (const file of files) {
      setUploadBusy((n) => n + 1);
      try {
        const r = await api.tasks.uploadCommentFile(task.id, file);
        orphanIdsRef.current.add(r.id);
        setPendingAttachments((prev) => [
          ...prev,
          { id: r.id, name: r.name, mime_type: r.mime_type, url: r.url },
        ]);
      } catch (err) {
        setUploadMsg(err?.message || 'Upload nije uspeo');
      } finally {
        setUploadBusy((n) => Math.max(0, n - 1));
      }
    }
  };

  const removePendingAttachment = async (index) => {
    const a = pendingAttachments[index];
    if (a?.id) {
      try {
        await api.tasks.deleteCommentFile(a.id);
      } catch {
        /* ignore */
      }
      orphanIdsRef.current.delete(a.id);
    }
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const startEditComment = (index) => {
    const c = form.comments[index];
    if (!c || !canUserEditComment(c, currentUser, readOnly)) return;
    setEditingCommentIndex(index);
    setEditCommentDraft(c.text ?? '');
  };

  const cancelEditComment = () => {
    setEditingCommentIndex(null);
    setEditCommentDraft('');
  };

  const saveEditComment = () => {
    if (editingCommentIndex === null) return;
    const index = editingCommentIndex;
    const draft = editCommentDraft.trim();
    const orig = (form.comments[index]?.text || '').trim();
    if (draft === orig) {
      cancelEditComment();
      return;
    }
    setForm((prev) => ({
      ...prev,
      comments: prev.comments.map((c, i) =>
        i === index
          ? { ...c, text: draft, edited_at: new Date().toISOString() }
          : c,
      ),
    }));
    cancelEditComment();
  };

  const handleSave = () => {
    if (readOnly || !onSave) return;
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
          <DialogTitle>{readOnly ? 'Pregled zadatka' : 'Detalji zadatka'}</DialogTitle>
        </DialogHeader>

        <ModalScrollArea>
          <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-2">
              <Label htmlFor="task-title">Naslov</Label>
              <Input
                id="task-title"
                value={form.title}
                disabled={readOnly}
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
                disabled={readOnly}
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
                        disabled={readOnly}
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
              users={users}
              currentUser={currentUser}
              newComment={newComment}
              setNewComment={setNewComment}
              addComment={addComment}
              readOnly={readOnly}
              pendingAttachments={pendingAttachments}
              uploadBusy={uploadBusy}
              uploadMsg={uploadMsg}
              onPickCommentFiles={onPickCommentFiles}
              removePendingAttachment={removePendingAttachment}
              editingCommentIndex={editingCommentIndex}
              editCommentDraft={editCommentDraft}
              setEditCommentDraft={setEditCommentDraft}
              onStartEditComment={startEditComment}
              onSaveEditComment={saveEditComment}
              onCancelEditComment={cancelEditComment}
            />
          </div>
        </ModalScrollArea>

        <DialogFooter className="px-5 py-4 border-t border-slate-200 flex-row justify-between sm:justify-between">
          {!readOnly && onDelete ? (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Obriši
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {readOnly ? 'Zatvori' : 'Otkaži'}
            </Button>
            {!readOnly && (
              <Button type="button" onClick={handleSave} disabled={!form.title.trim()}>Sačuvaj</Button>
            )}
          </span>
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
        {LABEL_OPTIONS.map((label) => {
          const selected = form.labels.includes(label);
          const color = LABEL_COLORS[label] || 'bg-slate-400 text-white';
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggleLabel(label)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selected
                  ? `${color} border-transparent`
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          );
        })}
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

function CommentsSection({
  form,
  users,
  currentUser,
  newComment,
  setNewComment,
  addComment,
  readOnly,
  pendingAttachments,
  uploadBusy,
  uploadMsg,
  onPickCommentFiles,
  removePendingAttachment,
  editingCommentIndex,
  editCommentDraft,
  setEditCommentDraft,
  onStartEditComment,
  onSaveEditComment,
  onCancelEditComment,
}) {
  const fileInputRef = useRef(null);
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Komentari
      </Label>
      {form.comments.map((comment, index) => (
        <CommentItem
          key={index}
          comment={comment}
          users={users}
          currentUser={currentUser}
          readOnly={readOnly}
          isEditing={editingCommentIndex === index}
          editDraft={editCommentDraft}
          setEditDraft={setEditCommentDraft}
          onStartEdit={() => onStartEditComment(index)}
          onSaveEdit={onSaveEditComment}
          onCancelEdit={onCancelEditComment}
        />
      ))}
      {!readOnly && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((a, i) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 max-w-full"
                >
                  <FileIcon className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span className="truncate min-w-0">{a.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600 shrink-0"
                    onClick={() => removePendingAttachment(i)}
                    aria-label="Ukloni prilog"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploadMsg ? <p className="text-xs text-red-600">{uploadMsg}</p> : null}
          <div className="flex gap-2 flex-wrap items-stretch">
            <Input
              placeholder="Tekst komentara (opciono ako imate prilog)…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) addComment();
              }}
              className="flex-1 min-w-[8rem]"
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.csv"
              onChange={onPickCommentFiles}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy > 0}
              title="Priloži fajl ili sliku"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addComment}
              disabled={uploadBusy > 0 || (!newComment.trim() && !pendingAttachments.length)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {uploadBusy > 0 ? (
            <p className="text-xs text-slate-500">Slanje priloga…</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CommentAttachmentView({ id, name, mime_type }) {
  const isImg = String(mime_type || '').startsWith('image/');
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const blob = await api.tasks.fetchCommentAttachmentBlob(id);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setLoadErr(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (loadErr) {
    return <p className="text-xs text-red-600">Prilog se ne može učitati.</p>;
  }
  if (!blobUrl) {
    return <p className="text-xs text-slate-400">Učitavanje priloga…</p>;
  }
  if (isImg) {
    return (
      <a href={blobUrl} download={name} className="block max-w-full">
        <img src={blobUrl} alt={name || 'Prilog'} className="max-h-52 max-w-full rounded border border-slate-200 object-contain" />
      </a>
    );
  }
  return (
    <a
      href={blobUrl}
      download={name || 'prilog'}
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
    >
      <FileIcon className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[14rem]">{name || 'Preuzmi fajl'}</span>
    </a>
  );
}

function CommentItem({
  comment,
  users,
  currentUser,
  readOnly,
  isEditing,
  editDraft,
  setEditDraft,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}) {
  const who = resolveCommentAuthorLabel(comment, users);
  const email = (comment?.author || '').trim();
  const attachments = Array.isArray(comment.attachments) ? comment.attachments : [];
  const canEdit = canUserEditComment(comment, currentUser, readOnly);

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm border border-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-1">
        <p className="text-xs font-semibold text-slate-800 min-w-0">{who}</p>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={onStartEdit}
                className="text-slate-400 hover:text-blue-600 p-0.5 rounded"
                title="Izmeni komentar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {comment.created_at && (
              <p className="text-[11px] text-slate-400 tabular-nums">
                {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            )}
          </div>
          {comment.edited_at && (
            <p className="text-[10px] text-amber-800 font-medium tabular-nums">
              Izmenjeno {format(new Date(comment.edited_at), 'dd.MM.yyyy HH:mm')}
            </p>
          )}
        </div>
      </div>
      {email && who !== email && (
        <p className="text-[11px] text-slate-500 mb-1">{email}</p>
      )}
      {isEditing ? (
        <div className="space-y-2 mt-1">
          {attachments.length > 0 && (
            <div className="space-y-2 rounded-md border border-dashed border-slate-200 bg-white/60 p-2">
              <p className="text-[10px] font-medium text-slate-500">Prilozi</p>
              {attachments.map((att) =>
                att?.id ? (
                  <CommentAttachmentView
                    key={att.id}
                    id={att.id}
                    name={att.name}
                    mime_type={att.mime_type}
                  />
                ) : null,
              )}
            </div>
          )}
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Tekst komentara…"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onCancelEdit}>
              Otkaži
            </Button>
            <Button type="button" size="sm" onClick={onSaveEdit}>
              Sačuvaj izmenu
            </Button>
          </div>
        </div>
      ) : (
        <>
          {comment.text ? (
            <p className="text-slate-700 whitespace-pre-wrap break-words">{comment.text}</p>
          ) : null}
          {attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {attachments.map((att) =>
                att?.id ? (
                  <CommentAttachmentView
                    key={att.id}
                    id={att.id}
                    name={att.name}
                    mime_type={att.mime_type}
                  />
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
