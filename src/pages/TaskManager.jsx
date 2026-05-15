import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BoardColumn from '@/components/taskmanager/BoardColumn';
import TaskDetailModal from '@/components/taskmanager/TaskDetailModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff } from 'lucide-react';
import UserProfileButton from '@/components/UserProfileButton';

export default function TaskManager() {
  const queryClient = useQueryClient();
  const { permission, requestPermission } = usePushNotifications();
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [users, setUsers] = useState([]);

  // Fetch users (admin only, ignore errors for regular users)
  useEffect(() => {
    base44.auth.me().then(me => {
      if (me?.role === 'admin') {
        base44.entities.User.list().then(setUsers).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const { data: columns = [], error: colError } = useQuery({
    queryKey: ['columns'],
    queryFn: async () => {
      const result = await base44.entities.Column.filter({}, 'order');
      console.log('COLUMNS RESULT:', JSON.stringify(result));
      return result;
    },
  });

  const { data: tasks = [], error: taskError } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const result = await base44.entities.Task.filter({}, 'order');
      console.log('TASKS RESULT:', JSON.stringify(result));
      return result;
    },
  });

  useEffect(() => {
    if (colError) console.error('COLUMN ERROR:', colError);
    if (taskError) console.error('TASK ERROR:', taskError);
  }, [colError, taskError]);

  const createColumn = useMutation({
    mutationFn: (name) => base44.entities.Column.create({ name, order: columns.length }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns'] }),
  });

  const deleteColumn = useMutation({
    mutationFn: (id) => base44.entities.Column.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns'] }),
  });

  const renameColumn = useMutation({
    mutationFn: ({ id, name }) => base44.entities.Column.update(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns'] }),
  });

  const createTask = useMutation({
    mutationFn: ({ columnId, title }) => {
      const colTasks = tasks.filter(t => t.column_id === columnId);
      return base44.entities.Task.create({ title, column_id: columnId, order: colTasks.length });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
    },
  });

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    createColumn.mutate(newColumnName.trim());
    setNewColumnName('');
    setAddingColumn(false);
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    await base44.entities.Task.update(draggableId, {
      column_id: destination.droppableId,
      order: destination.index,
    });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const getColumnTasks = (columnId) =>
    tasks.filter(t => t.column_id === columnId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/">
            <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-white font-bold text-lg">Manager Zadataka</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={requestPermission}
            title={permission === 'granted' ? 'Notifikacije uključene' : 'Uključi notifikacije'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${permission === 'granted' ? 'bg-green-400/30 hover:bg-green-400/40' : 'bg-white/20 hover:bg-white/30 animate-pulse'}`}
          >
            {permission === 'granted'
              ? <Bell className="w-4 h-4 text-white" />
              : <BellOff className="w-4 h-4 text-white" />
            }
          </button>
          <UserProfileButton />
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingTop: '8px', paddingBottom: '8px' }}>
            {columns.map(col => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={getColumnTasks(col.id)}
                onAddTask={(columnId, title) => createTask.mutate({ columnId, title })}
                onCardClick={setSelectedTask}
                onDeleteColumn={(id) => deleteColumn.mutate(id)}
                onRenameColumn={(id, name) => renameColumn.mutate({ id, name })}
              />
            ))}

            {/* Add Column */}
            <div className="flex-shrink-0 w-72">
              {addingColumn ? (
                <div className="bg-slate-100 rounded-2xl p-3 space-y-2">
                  <Input
                    autoFocus
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    placeholder="Naziv kolone..."
                    className="bg-white"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingColumn(false); }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddColumn} className="flex-1">Dodaj kolonu</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)} className="text-slate-500">Otkaži</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white rounded-2xl px-4 py-3 text-sm font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Dodaj kolonu
                </button>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onSave={(data) => updateTask.mutate({ id: selectedTask.id, data })}
          onDelete={() => deleteTask.mutate(selectedTask.id)}
        />
      )}
    </div>
  );
}