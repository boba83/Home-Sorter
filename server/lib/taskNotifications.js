import { displayFullName } from './serialize.js';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isUrgent(labels) {
  return parseJsonArray(labels).includes('Hitno');
}

async function getActor(prisma, userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return { email: '', name: 'Neko' };
  return { email: u.email, name: displayFullName(u) || u.email };
}

async function userIdForEmail(prisma, email) {
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email } });
  return u?.id ?? null;
}

async function createNotification(prisma, { userId, type, severity, taskId, title, message }) {
  await prisma.notification.create({
    data: { userId, type, severity, taskId, title, message },
  });
}

export async function notifyOnTaskCreated(prisma, task, actorUserId) {
  const assignees = parseJsonArray(task.assignedUsers);
  if (!assignees.length) return;

  const urgent = isUrgent(task.labels);
  const actor = await getActor(prisma, actorUserId);

  for (const email of assignees) {
    if (email === actor.email) continue;
    const userId = await userIdForEmail(prisma, email);
    if (!userId) continue;
    await createNotification(prisma, {
      userId,
      type: 'assigned',
      severity: urgent ? 'urgent' : 'normal',
      taskId: task.id,
      title: urgent ? 'HITNO: Dodeljen zadatak' : 'Dodeljen vam je zadatak',
      message: task.title,
    });
  }
}

export async function notifyOnTaskUpdated(prisma, existing, updated, actorUserId, body) {
  const actor = await getActor(prisma, actorUserId);
  const oldLabels = parseJsonArray(existing.labels);
  const newLabels = parseJsonArray(updated.labels);
  const urgent = isUrgent(updated.labels);

  if (body.assigned_users !== undefined) {
    const oldSet = new Set(parseJsonArray(existing.assignedUsers));
    const newAssignees = parseJsonArray(updated.assignedUsers);
    for (const email of newAssignees) {
      if (oldSet.has(email) || email === actor.email) continue;
      const userId = await userIdForEmail(prisma, email);
      if (!userId) continue;
      await createNotification(prisma, {
        userId,
        type: 'assigned',
        severity: urgent ? 'urgent' : 'normal',
        taskId: updated.id,
        title: urgent ? 'HITNO: Dodeljen zadatak' : 'Dodeljen vam je zadatak',
        message: updated.title,
      });
    }
  }

  if (body.comments !== undefined) {
    const oldComments = parseJsonArray(existing.comments);
    const newComments = parseJsonArray(updated.comments);
    if (newComments.length > oldComments.length) {
      const added = newComments.slice(oldComments.length);
      const assignees = parseJsonArray(updated.assignedUsers);
      for (const comment of added) {
        const commentAuthor = (comment.author || actor.email || '').toLowerCase();
        const preview = (comment.text || '').slice(0, 100);
        const att = Array.isArray(comment.attachments) ? comment.attachments : [];
        const attHint =
          att.length > 0 ? ` [+${att.length} prilog${att.length === 1 ? '' : 'a'}]` : '';
        const authorLabel =
          (comment.author_name && String(comment.author_name).trim()) ||
          (comment.author && String(comment.author).toLowerCase() !== String(actor.email || '').toLowerCase()
            ? comment.author
            : actor.name);
        for (const email of assignees) {
          if (email.toLowerCase() === commentAuthor) continue;
          const userId = await userIdForEmail(prisma, email);
          if (!userId) continue;
          await createNotification(prisma, {
            userId,
            type: 'comment',
            severity: urgent ? 'urgent' : 'normal',
            taskId: updated.id,
            title: urgent ? 'HITNO: Novi komentar' : 'Novi komentar na zadatku',
            message: `${authorLabel}: "${preview}${attHint}" — ${updated.title}`,
          });
        }
      }
    }
  }

  if (body.labels !== undefined && !isUrgent(oldLabels) && isUrgent(newLabels)) {
    const assignees = parseJsonArray(updated.assignedUsers);
    for (const email of assignees) {
      if (email === actor.email) continue;
      const userId = await userIdForEmail(prisma, email);
      if (!userId) continue;
      await createNotification(prisma, {
        userId,
        type: 'urgent',
        severity: 'urgent',
        taskId: updated.id,
        title: 'HITNO: Zadatak je označen kao hitan',
        message: updated.title,
      });
    }
  }
}
