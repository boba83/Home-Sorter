import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    ChevronRight,
    Download,
    Eye,
    FileText,
    Folder,
    FolderPlus,
    Info,
    Loader2,
    Pencil,
    Trash2,
    Upload,
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    DEFAULT_FOLDER_COLOR,
    INFO_FOLDER_COLORS,
    folderTint,
    resolveFolderColor,
} from '@/lib/infoFolderColors';
import {
    canPreviewInfoFile,
    getInfoFilePreviewKind,
} from '@/lib/infoFilePreview';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportantInfo() {
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folderColor, setFolderColor] = useState(DEFAULT_FOLDER_COLOR);
    const [editTarget, setEditTarget] = useState(null);

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => api.auth.me(),
    });

    const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'user';
    const canDelete = currentUser?.role === 'admin';
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ['infoBrowse', currentFolderId],
        queryFn: () => api.info.browse(currentFolderId),
    });

    const folders = data?.folders ?? [];
    const files = data?.files ?? [];
    const breadcrumb = data?.breadcrumb ?? [];

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['infoBrowse'] });
    };

    const handleCreateFolder = async () => {
        const name = folderName.trim();
        if (!name) return;
        setIsSaving(true);
        try {
            await api.info.createFolder(name, currentFolderId, folderColor);
            setFolderName('');
            setFolderColor(DEFAULT_FOLDER_COLOR);
            setFolderDialogOpen(false);
            invalidate();
        } catch (e) {
            alert(e.message || 'Greška');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateFolder = async () => {
        if (!editTarget) return;
        const name = folderName.trim();
        if (!name) return;
        setIsSaving(true);
        try {
            await api.info.updateFolder(editTarget.id, { name, color: folderColor });
            setFolderName('');
            setFolderColor(DEFAULT_FOLDER_COLOR);
            setEditTarget(null);
            setFolderDialogOpen(false);
            invalidate();
        } catch (e) {
            alert(e.message || 'Greška');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        const pending = deleteConfirm;
        if (!pending?.item) return;
        setIsSaving(true);
        try {
            if (pending.type === 'folder') {
                await api.info.deleteFolder(pending.item.id);
                if (currentFolderId === pending.item.id) {
                    setCurrentFolderId(pending.item.parent_id ?? null);
                }
            } else {
                await api.info.deleteFile(pending.item.id);
            }
            setDeleteConfirm(null);
            invalidate();
        } catch (e) {
            alert(e.message || 'Greška');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpload = async (event) => {
        const picked = event.target.files?.[0];
        event.target.value = '';
        if (!picked || !currentFolderId) return;
        setIsSaving(true);
        try {
            await api.info.uploadFile(currentFolderId, picked);
            invalidate();
        } catch (e) {
            alert(e.message || 'Upload nije uspeo');
        } finally {
            setIsSaving(false);
        }
    };

    const closeFilePreview = () => {
        if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
        setFilePreview(null);
    };

    const handlePreviewFile = async (file) => {
        const kind = getInfoFilePreviewKind(file);
        if (kind === 'office') {
            alert(
                'Word, Excel i PowerPoint fajlovi se ne mogu otvoriti u pregledaču. Koristite Preuzmi i otvorite u odgovarajućoj aplikaciji.',
            );
            return;
        }
        if (!canPreviewInfoFile(file)) {
            alert('Ovaj tip fajla nije podržan za pregled u pregledaču. Preuzmite ga umesto toga.');
            return;
        }
        setPreviewLoading(true);
        try {
            const { url, blob } = await api.info.previewFile(file);
            let textContent = null;
            if (kind === 'text') {
                textContent = await blob.text();
            }
            setFilePreview({
                id: file.id,
                name: file.name,
                kind,
                url,
                textContent,
            });
        } catch (e) {
            alert(e.message || 'Pregled nije uspeo');
        } finally {
            setPreviewLoading(false);
        }
    };

    const openNewFolderDialog = () => {
        setEditTarget(null);
        setFolderName('');
        setFolderColor(DEFAULT_FOLDER_COLOR);
        setFolderDialogOpen(true);
    };

    const openEditDialog = (folder) => {
        setEditTarget(folder);
        setFolderName(folder.name);
        setFolderColor(resolveFolderColor(folder.color));
        setFolderDialogOpen(true);
    };

    const renderFolderIcon = (color, className = 'w-8 h-8') => {
        const hex = resolveFolderColor(color);
        return <Folder className={`${className} shrink-0`} style={{ color: hex }} fill={folderTint(hex, 0.2)} />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col p-4 sm:p-8">
            <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/">
                        <button
                            type="button"
                            className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                                <Info className="w-5 h-5 text-white" />
                            </div>
                            Bitne informacije
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">Fascikle i dokumenti</p>
                    </div>
                </div>

                <div className="bg-white border border-orange-100 rounded-2xl shadow-sm flex flex-col min-h-[420px]">
                    <div className="flex flex-wrap items-center gap-2 p-4 border-b border-orange-50">
                        <button
                            type="button"
                            onClick={() => setCurrentFolderId(null)}
                            className={`text-sm font-medium px-2 py-1 rounded-md transition-colors ${
                                !currentFolderId
                                    ? 'text-orange-700 bg-orange-50'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Početak
                        </button>
                        {breadcrumb.map((crumb) => (
                            <React.Fragment key={crumb.id}>
                                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                <button
                                    type="button"
                                    onClick={() => setCurrentFolderId(crumb.id)}
                                    className={`text-sm font-medium px-2 py-1 rounded-md transition-colors truncate max-w-[140px] flex items-center gap-1.5 ${
                                        currentFolderId === crumb.id
                                            ? 'text-slate-800'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                    style={
                                        currentFolderId === crumb.id
                                            ? { backgroundColor: folderTint(crumb.color, 0.15) }
                                            : undefined
                                    }
                                >
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: resolveFolderColor(crumb.color) }}
                                    />
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {canEdit && (
                        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-orange-200 text-orange-800 hover:bg-orange-50"
                                onClick={openNewFolderDialog}
                                disabled={isSaving}
                            >
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Nova fascikla
                            </Button>
                            {currentFolderId && (
                                <>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="bg-orange-500 hover:bg-orange-600"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 mr-2" />
                                        )}
                                        Dodaj fajl
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleUpload}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    <div className="p-4 flex-1">
                        {isLoading ? (
                            <div className="flex justify-center py-16 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        ) : error ? (
                            <p className="text-center text-red-600 py-8">{error.message}</p>
                        ) : folders.length === 0 && files.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Folder className="w-12 h-12 mx-auto text-orange-200 mb-3" />
                                <p className="font-medium text-slate-700">
                                    {currentFolderId
                                        ? 'Fascikla je prazna'
                                        : 'Još nema fascikli'}
                                </p>
                                <p className="text-sm mt-1">
                                    {canEdit
                                        ? currentFolderId
                                            ? 'Dodajte fajl ili podfasciklu.'
                                            : 'Kreirajte prvu fasciklu.'
                                        : 'Nema sadržaja za prikaz.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {folders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-2 p-3 rounded-xl group transition-colors hover:bg-slate-50/80"
                                        style={{ ['--folder-tint']: folderTint(folder.color, 0.12) }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = folderTint(folder.color, 0.12);
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '';
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        >
                                            {renderFolderIcon(folder.color)}
                                            <span className="font-medium text-slate-800 truncate">
                                                {folder.name}
                                            </span>
                                        </button>
                                        {canEdit && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEditDialog(folder)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                {canDelete && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() =>
                                                            setDeleteConfirm({ type: 'folder', item: folder })
                                                        }
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {files.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-2 p-3 rounded-xl hover:bg-slate-50 group"
                                    >
                                        <FileText className="w-8 h-8 text-slate-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 truncate">{file.name}</p>
                                            <p className="text-xs text-slate-500">{formatBytes(file.size_bytes)}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {canPreviewInfoFile(file) && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    title="Otvori u pregledaču"
                                                    disabled={previewLoading}
                                                    onClick={() => handlePreviewFile(file)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                title="Preuzmi"
                                                onClick={() => api.info.downloadFile(file.id, file.name)}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            {canDelete && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                                    onClick={() =>
                                                        setDeleteConfirm({ type: 'file', item: file })
                                                    }
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog
                open={folderDialogOpen}
                onOpenChange={(open) => {
                    setFolderDialogOpen(open);
                    if (!open) {
                        setEditTarget(null);
                        setFolderName('');
                        setFolderColor(DEFAULT_FOLDER_COLOR);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editTarget ? 'Uredi fasciklu' : 'Nova fascikla'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        <div>
                            <Label htmlFor="folderName">Naziv</Label>
                            <Input
                                id="folderName"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                placeholder="npr. Telefoni, Ugovori..."
                                className="mt-2"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        editTarget ? handleUpdateFolder() : handleCreateFolder();
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <Label className="mb-2 block">Boja</Label>
                            <div className="flex flex-wrap gap-2">
                                {INFO_FOLDER_COLORS.map((c) => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        title={c.label}
                                        onClick={() => setFolderColor(c.hex)}
                                        className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                                            folderColor === c.hex
                                                ? 'border-slate-800 ring-2 ring-offset-2 ring-slate-400'
                                                : 'border-white shadow-sm'
                                        }`}
                                        style={{ backgroundColor: c.hex }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                                {renderFolderIcon(folderColor, 'w-5 h-5')}
                                {INFO_FOLDER_COLORS.find((c) => c.hex === folderColor)?.label ?? 'Podrazumevano'}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
                            Otkaži
                        </Button>
                        <Button
                            className="bg-orange-500 hover:bg-orange-600"
                            disabled={isSaving || !folderName.trim()}
                            onClick={editTarget ? handleUpdateFolder : handleCreateFolder}
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sačuvaj
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(filePreview)}
                onOpenChange={(open) => {
                    if (!open) closeFilePreview();
                }}
            >
                <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{filePreview?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-slate-50">
                        {filePreview?.kind === 'pdf' && (
                            <iframe
                                title={filePreview.name}
                                src={filePreview.url}
                                className="w-full h-[70vh] min-h-[320px] bg-white"
                            />
                        )}
                        {filePreview?.kind === 'image' && (
                            <div className="flex justify-center p-4">
                                <img
                                    src={filePreview.url}
                                    alt={filePreview.name}
                                    className="max-w-full max-h-[70vh] object-contain"
                                />
                            </div>
                        )}
                        {filePreview?.kind === 'text' && (
                            <pre className="p-4 text-sm text-slate-800 whitespace-pre-wrap break-words font-mono max-h-[70vh] overflow-auto">
                                {filePreview.textContent}
                            </pre>
                        )}
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() =>
                                filePreview &&
                                api.info.downloadFile(filePreview.id, filePreview.name)
                            }
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Preuzmi
                        </Button>
                        <Button onClick={closeFilePreview}>Zatvori</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(deleteConfirm)}
                onOpenChange={(open) => {
                    if (!open && !isSaving) setDeleteConfirm(null);
                }}
            >
                {deleteConfirm && (
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {deleteConfirm.type === 'folder'
                                    ? 'Obrisati fasciklu?'
                                    : 'Obrisati fajl?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {deleteConfirm.type === 'folder' ? (
                                    <>
                                        Da li ste sigurni da želite da obrišete fasciklu{' '}
                                        <strong>„{deleteConfirm.item.name}"</strong> i sav sadržaj unutra?
                                        Ova radnja se ne može poništiti.
                                    </>
                                ) : (
                                    <>
                                        Da li ste sigurni da želite da obrišete fajl{' '}
                                        <strong>„{deleteConfirm.item.name}"</strong>?
                                    </>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSaving}>Otkaži</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={isSaving}
                                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                onClick={(e) => {
                                    e.preventDefault();
                                    confirmDelete();
                                }}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Obriši'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>
        </div>
    );
}
