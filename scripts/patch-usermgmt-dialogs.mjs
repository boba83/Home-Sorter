import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/UserManagment.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const passwordBlock = `
                        <section className="pt-3 border-t border-slate-200 space-y-2">
                            <Label className="text-sm">Lozinka</Label>
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAdminResetPassword} disabled={isSaving}>
                                <KeyRound className="w-4 h-4 mr-2" />
                                Generiši novu privremenu lozinku
                            </Button>
                            {adminTempPassword && (
                                <section className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                    <p className="font-mono text-lg select-all">{adminTempPassword}</p>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard?.writeText(adminTempPassword)}>
                                        <Copy className="w-3 h-3 mr-1" /> Kopiraj
                                    </Button>
                                </section>
                            )}
                        </section>`;

s = s.replace(
  /(\s+<\/Select>\s+<\/motionless>\s+)(<\/motionless>\s+<DialogFooter>\s+<Button variant="outline" onClick=\{\(\) => setIsEditingUser\(false\)\}>Cancel)/,
  `$1${passwordBlock}
                    </motionless>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingUser(false)}>Otkaži`
);

// fix botched replace - use div not motionless
s = s.replace(/<\/motionless>\s+<\/motionless>\s+<DialogFooter>/g, `</div>${passwordBlock}
                    </div>
                    <DialogFooter>`);

// simpler: insert before edit dialog footer
const editMarker = '                    </div>\n                    <DialogFooter>\n                        <Button variant="outline" onClick={() => setIsEditingUser(false)}>Cancel';
if (s.includes(editMarker) && !s.includes('handleAdminResetPassword')) {
  s = s.replace(editMarker, `${passwordBlock}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingUser(false)}>Otkaži`);
}

const addDialog = `
            <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj korisnika</DialogTitle>
                    </DialogHeader>
                    <section className="py-4 space-y-4">
                        <p className="text-sm text-slate-500">
                            Samo dodati korisnici mogu da se prijave. Prosledite im email i privremenu lozinku.
                        </p>
                        {createdCredentials ? (
                            <section className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                                <p className="text-green-900 font-medium">Nalog kreiran</p>
                                <p className="text-sm">Email: <strong>{createdCredentials.email}</strong></p>
                                <p className="font-mono text-xl text-green-950 select-all">{createdCredentials.temporary_password}</p>
                                <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(\`Email: \${createdCredentials.email}\\nLozinka: \${createdCredentials.temporary_password}\`)}>
                                    <Copy className="w-3 h-3 mr-1" /> Kopiraj podatke za prijavu
                                </Button>
                            </section>
                        ) : (
                            <>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Email *</span>
                                    <Input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Ime (opciono)</span>
                                    <Input value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Prezime (opciono)</span>
                                    <Input value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Uloga</span>
                                    <Select value={newUserForm.role} onValueChange={(role) => setNewUserForm({ ...newUserForm, role })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">Korisnik</SelectItem>
                                            <SelectItem value="viewer">Pregledač</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                            </>
                        )}
                    </section>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddingUser(false); setCreatedCredentials(null); }}>
                            {createdCredentials ? 'Zatvori' : 'Otkaži'}
                        </Button>
                        {!createdCredentials && (
                            <Button onClick={handleCreateUser} disabled={isSaving || !newUserForm.email.trim()}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Kreiraj nalog
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>`;

const inviteStart = s.indexOf('<Dialog open={isInviting}');
const inviteEnd = s.indexOf('</Dialog>', inviteStart) + '</Dialog>'.length;
if (inviteStart > 0) {
  s = s.slice(0, inviteStart) + addDialog + s.slice(inviteEnd);
}

// fix Save -> Sačuvaj in edit footer if still Cancel
s = s.replace(
  /setIsEditingUser\(false\)\}>Cancel<\/Button>\s+<Button onClick={handleSaveUser}[\s\S]*?>Save<\/Button>/,
  `setIsEditingUser(false)}>Otkaži</Button>
                        <Button onClick={handleSaveUser} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sačuvaj</Button>`
);

fs.writeFileSync(filePath, s);
console.log('patched');
