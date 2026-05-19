import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";

export default function FileUploader({ onDataExtracted, defaultLocation = null }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [status, setStatus] = useState('idle');

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await processFile(files[0]);
        }
    };

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            await processFile(files[0]);
        }
    };

    const processFile = async (file) => {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.pdf')) {
            alert('Please upload a PDF file');
            return;
        }
        
        // Rename file to have lowercase extension for API compatibility
        const newFile = new File([file], file.name.toLowerCase(), { type: 'application/pdf' });

        setUploadedFile(file);
        setIsUploading(true);
        setIsExtracting(true);
        setStatus('extracting');

        let result;
        try {
            result = await base44.integrations.Core.ExtractDataFromUploadedFile({ file: newFile });
        } catch (err) {
            setStatus('error');
            alert(err?.message || 'Greška pri slanju PDF-a na server.');
            setIsUploading(false);
            setIsExtracting(false);
            return;
        }

        setIsUploading(false);
        setIsExtracting(false);

        if (result.status === 'success' && result.output) {
            const output = result.output;
            const entries = output.entries ?? (Array.isArray(output) ? output : []);
            if (!entries.length) {
                setStatus('error');
                const hint = output.warnings?.[0] || output.parseMode === 'generic'
                    ? 'Format nije prepoznat kao Astra rooming lista.'
                    : '';
                alert(
                    'PDF je učitan, ali nije prepoznat nijedan red (soba / gost). ' +
                    (hint ? `${hint} ` : '') +
                    'Proverite PDF ili dodajte kuće/sobe ručno.'
                );
                return;
            }
            const missing = output.hotelsMissingRooms ?? [];
            if (missing.length > 0) {
                alert(
                    `Upozorenje: kuće bez prepoznatih soba: ${missing.join(', ')}.\n` +
                    'U preview-u su crvene — import je blokiran dok se ne reši.'
                );
            } else if (output.warnings?.length) {
                alert(output.warnings.join('\n'));
            }
            setStatus('success');
            onDataExtracted({
                entries,
                location: defaultLocation || output.location || null,
                hotels: output.hotels ?? [],
                hotelsMissingRooms: missing,
                parseMode: output.parseMode,
                warnings: output.warnings ?? [],
            });
        } else {
            setStatus('error');
            alert('Greška pri čitanju PDF-a: ' + (result.details || 'Nepoznata greška'));
        }
    };

    const reset = () => {
        setUploadedFile(null);
        setStatus('idle');
    };

    return (
        <Card className={cn(
            "border-2 border-dashed transition-all duration-300",
            isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200",
            status === 'success' && "border-green-500 bg-green-50"
        )}>
            <CardContent className="p-8">
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center text-center"
                >
                    {status === 'idle' && (
                        <>
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <Upload className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                Upload PDF File
                            </h3>
                            <p className="text-slate-500 mb-4 max-w-sm">
                                Drag and drop your PDF file here, or click to browse. 
                                The file should contain house, room, and occupant information.
                            </p>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload">
                                <Button asChild>
                                    <span className="cursor-pointer">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Select PDF File
                                    </span>
                                </Button>
                            </label>
                        </>
                    )}

                    {(isUploading || isExtracting) && (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                            <p className="text-slate-600 font-medium">
                                {isUploading ? 'Uploading file...' : 'Extracting data from PDF...'}
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                                {uploadedFile?.name}
                            </p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-green-600 font-medium mb-1">
                                PDF je pročitan — pregledajte tabelu ispod.
                            </p>
                            <p className="text-slate-500 text-sm mb-4">
                                Kliknite <strong>Import Data</strong> da se podaci sačuvaju
                                {defaultLocation ? ` u lokaciji ${defaultLocation}` : ''}.
                            </p>
                            <Button variant="outline" onClick={reset}>
                                Upload Another File
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}