import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { LABEL_COLORS } from './taskLabels';

export default function TaskCard({ task, onClick, dragHandleProps = {}, draggableProps = {}, innerRef }) {
  const doneCount = (task.checklists || []).filter(c => c.done).length;
  const totalCount = (task.checklists || []).length;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-150 select-none overflow-hidden"
    >
      {task.card_color && (
        <div className="px-3 py-1.5 flex items-center gap-2" style={{ backgroundColor: task.card_color }}>
          <span className="text-white text-xs font-semibold truncate">
            {task.epic_title || 'Epic'}
          </span>
        </div>
      )}
      <div className="p-3">
      {/* Labels */}
      {(task.labels || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label, i) => (
            <span key={i} className={`${LABEL_COLORS[label] || 'bg-slate-400 text-white'} text-xs px-2 py-0.5 rounded-full`}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 leading-snug mb-2">{task.title}</p>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        {task.due_date && (
          <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {format(new Date(task.due_date), 'dd.MM.yy')}
          </span>
        )}
        {totalCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <CheckSquare className="w-3 h-3" />
            {doneCount}/{totalCount}
          </span>
        )}
        {(task.assigned_users || []).length > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {task.assigned_users.slice(0, 3).map((email, i) => (
              <div
                key={i}
                title={email}
                className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
              >
                {email[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}