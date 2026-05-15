import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

export default function ImportantInfo() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-xl">
                <div className="flex items-center gap-3 mb-8">
                    <Link to="/">
                        <button className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                                <Info className="w-5 h-5 text-white" />
                            </div>
                            Bitne Informacije
                        </h1>
                        <p className="text-slate-500 mt-1">Kontakti i važne informacije</p>
                    </div>
                </div>

                <div className="bg-white border border-orange-100 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
                        <Info className="w-10 h-10 text-orange-300" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-600 mb-2">Sadržaj dolazi uskoro</h2>
                    <p className="text-slate-400 text-sm">Ovde će biti smešteni telefonski brojevi i ostale bitne informacije.</p>
                </div>
            </div>
        </div>
    );
}