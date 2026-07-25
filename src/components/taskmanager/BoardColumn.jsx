import React, { useState, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TaskCard from './TaskCard';

export default function BoardColumn({
  column,
  tasks,
  onAddTask,
  onCardClick,
  onDeleteColumn,
  onRenameColumn,
  canDragTasks = true,
  innerRef,
  draggableProps = {},
  dragHandleProps,
  isDragging = false,
}) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [colName, setColName] = useState(column.name);

  useEffect(() => {
    setColName(column.name);
  }, [column.name]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !onAddTask) return;
    onAddTask(column.id, newTaskTitle.trim());
    setNewTaskTitle('');
    setAddingTask(false);
  };

  const handleRename = () => {
    if (colName.trim() && onRenameColumn) onRenameColumn(column.id, colName.trim());
    setEditingName(false);
  };

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl flex flex-col max-h-full transition-shadow ${
        isDragging ? 'shadow-2xl ring-2 ring-white/60 rotate-[0.5deg]' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2 gap-1">
        {dragHandleProps ? (
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5 rounded shrink-0 touch-none"
            title="Prevuci kolonu"
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : null}
        {editingName && onRenameColumn ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={colName}
              onChange={(e) => setColName(e.target.value)}
              className="h-7 text-sm font-semibold bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
            <button type="button" onClick={handleRename} className="text-green-600 hover:text-green-700">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setEditingName(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-semibold text-slate-700 text-sm truncate">{column.name}</h3>
            <span className="bg-slate-300 text-slate-600 text-xs rounded-full px-1.5 py-0.5 flex-shrink-0">
              {tasks.length}
            </span>
            {onRenameColumn ? (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-slate-300 hover:text-slate-500 flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        )}
        {onDeleteColumn ? (
          <button
            type="button"
            onClick={() => onDeleteColumn(column.id)}
            className="text-slate-300 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
            title="Obriši kolonu"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Droppable area */}
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[80px] transition-colors duration-150 rounded-xl ${
              snapshot.isDraggingOver ? 'bg-blue-100/80' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task.id}
                draggableId={task.id}
                index={index}
                isDragDisabled={!canDragTasks}
              >
                {(dragProvided, dragSnapshot) => (
                  <TaskCard
                    task={task}
                    onClick={() => onCardClick(task)}
                    innerRef={dragProvided.innerRef}
                    draggableProps={dragProvided.draggableProps}
                    dragHandleProps={dragProvided.dragHandleProps}
                    isDragging={dragSnapshot.isDragging}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Task */}
      <div className="px-2 pb-3">
        {onAddTask ? (
          addingTask ? (
            <div className="space-y-2">
              <Input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Naslov zadatka..."
                className="text-sm bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTask();
                  if (e.key === 'Escape') setAddingTask(false);
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddTask} className="flex-1">
                  Dodaj
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingTask(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingTask(true)}
              className="w-full flex items-center gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl px-3 py-2 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Dodaj karticu
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
