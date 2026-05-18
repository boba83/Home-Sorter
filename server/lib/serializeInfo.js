export function serializeInfoFolder(f) {
  return {
    id: f.id,
    name: f.name,
    color: f.color ?? null,
    parent_id: f.parentId ?? null,
    created_by: f.createdBy ?? null,
    created_date: f.createdAt?.toISOString?.() ?? f.createdAt,
    updated_date: f.updatedAt?.toISOString?.() ?? f.updatedAt,
  };
}

export function serializeInfoFile(f) {
  return {
    id: f.id,
    folder_id: f.folderId,
    name: f.name,
    mime_type: f.mimeType ?? null,
    size_bytes: f.sizeBytes ?? 0,
    uploaded_by: f.uploadedBy ?? null,
    created_date: f.createdAt?.toISOString?.() ?? f.createdAt,
  };
}
