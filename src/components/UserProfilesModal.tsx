import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Plus, Trash2, Edit3, Database, Save, Upload, FileText, 
  Settings, History, Sparkles, Check, ChevronLeft, HardDrive, Shield, MessageSquare
} from 'lucide-react';
import { UserProfile, UserProfileDataSource, SavedConversationSession, PersonaData } from '../types';
import { DEFAULT_30_VOICES } from '../constants';
import ConfirmModal from './ConfirmModal';

interface UserProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  personas: Record<string, PersonaData>;
  onSaveProfile: (profile: UserProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onSelectActiveProfile?: (profile: UserProfile) => void;
  activeProfileId?: string;
  currentChatMessages?: { role: 'user' | 'model'; text: string }[];
  activePersonaName?: string;
  dynamicVoices?: string[];
}

export const UserProfilesModal: React.FC<UserProfilesModalProps> = ({
  isOpen,
  onClose,
  profiles,
  personas,
  onSaveProfile,
  onDeleteProfile,
  onSelectActiveProfile,
  activeProfileId,
  currentChatMessages = [],
  activePersonaName = '',
  dynamicVoices
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(activeProfileId || (profiles[0]?.id || null));
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [profileToDeleteId, setProfileToDeleteId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<{ profile: UserProfile; sessionId: string; title: string } | null>(null);

  // New Data source inputs
  const [newDsName, setNewDsName] = useState('');
  const [newDsType, setNewDsType] = useState<'pdf' | 'text' | 'url' | 'note'>('text');
  const [newDsSnippet, setNewDsSnippet] = useState('');

  if (!isOpen) return null;

  const currentProfile = profiles.find(p => p.id === selectedProfileId);

  const handleStartCreate = () => {
    const firstPersonaKey = Object.keys(personas)[0] || 'ستيف جوبز';
    const newProfile: UserProfile = {
      id: 'profile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: 'بروفايل جديد',
      personaId: firstPersonaKey,
      bio: 'وصف تخصيص الشخصية ومصادر البيانات المعرفية المستهدفة',
      createdAt: new Date().toLocaleDateString('ar-SA'),
      dataSources: [],
      parameters: {
        voice: personas[firstPersonaKey]?.voice || 'Puck',
        ttsTone: personas[firstPersonaKey]?.ttsTone || 'تلقائي',
        reasoningStyle: 'منطقي تحليلي',
        temperature: 0.7
      },
      savedSessions: []
    };
    setEditForm(newProfile);
    setIsEditing(true);
  };

  const handleStartEdit = (profile: UserProfile) => {
    setEditForm(JSON.parse(JSON.stringify(profile)));
    setIsEditing(true);
  };

  const handleSaveForm = () => {
    if (!editForm.name || !editForm.id) return;
    onSaveProfile(editForm as UserProfile);
    setSelectedProfileId(editForm.id);
    setIsEditing(false);
  };

  const handleAddDataSource = () => {
    if (!newDsName.trim() || !editForm) return;
    const ds: UserProfileDataSource = {
      id: 'ds_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: newDsName.trim(),
      type: newDsType,
      snippet: newDsSnippet.trim(),
      addedAt: new Date().toLocaleDateString('ar-SA')
    };
    const updatedDataSources = [...(editForm.dataSources || []), ds];
    setEditForm({ ...editForm, dataSources: updatedDataSources });
    setNewDsName('');
    setNewDsSnippet('');
  };

  const handleRemoveDataSource = (dsId: string) => {
    if (!editForm || !editForm.dataSources) return;
    setEditForm({
      ...editForm,
      dataSources: editForm.dataSources.filter(d => d.id !== dsId)
    });
  };

  const handleSaveCurrentSessionToProfile = (profile: UserProfile) => {
    if (!currentChatMessages || currentChatMessages.length === 0) return;
    const session: SavedConversationSession = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: `جلسة محادثة مع ${activePersonaName || profile.personaId} (${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})`,
      personaId: profile.personaId,
      messageCount: currentChatMessages.length,
      savedAt: new Date().toLocaleDateString('ar-SA'),
      messages: currentChatMessages
    };

    const updatedProfile = {
      ...profile,
      savedSessions: [session, ...(profile.savedSessions || [])]
    };

    onSaveProfile(updatedProfile);
  };

  const handleRemoveSession = (profile: UserProfile, sessionId: string) => {
    const updatedProfile = {
      ...profile,
      savedSessions: profile.savedSessions.filter(s => s.id !== sessionId)
    };
    onSaveProfile(updatedProfile);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface border border-accent/25 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative my-auto"
        >
          {/* Top Header */}
          <div className="p-4 sm:p-5 border-b border-border bg-surface2/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-accent/15 border border-accent/30 text-accent">
                <User size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  نظام إدارة بروفايلات المستخدم والشخصيات
                  <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-mono">
                    User Persona Profiles
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  تخصيص ملفات التعريف، إرفاق مصادر البيانات الخاصة، ضبط المعلمات وسجل المحادثات المحفوظة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-text hover:bg-surface2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Content Layout */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar: Profile List */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-e border-border bg-surface/50 p-4 flex flex-col shrink-0 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">البروفايلات المسجلة</span>
                <button
                  onClick={handleStartCreate}
                  className="px-2.5 py-1.5 rounded-xl bg-accent text-bg font-bold text-xs flex items-center gap-1 hover:brightness-110 transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={14} />
                  <span>بروفايل جديد</span>
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pe-1">
                {profiles.map(p => {
                  const isSelected = p.id === selectedProfileId;
                  const isActive = p.id === activeProfileId;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        setIsEditing(false);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-accent/15 border-accent text-text shadow-sm'
                          : 'bg-surface2/50 border-border/80 text-muted hover:border-accent/40 hover:text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                          isSelected ? 'bg-accent text-bg' : 'bg-surface border border-border text-text'
                        }`}>
                          {(p.name || '?').charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold text-xs text-text truncate flex items-center gap-1">
                            {p.name}
                            {isActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400" title="البروفايل النشط" />
                            )}
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            الشخصية: {p.personaId}
                          </div>
                        </div>
                      </div>

                      {onSelectActiveProfile && !isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectActiveProfile(p);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                          title="تفعيل هذا البروفايل للتعامل الحرفي"
                        >
                          تفعيل
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile Detail or Edit Pane */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-surface2/20">
              {isEditing ? (
                /* EDIT FORM */
                <div className="space-y-5 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-bold text-text flex items-center gap-2">
                      <Edit3 size={16} className="text-accent" />
                      {editForm.id?.startsWith('profile_') ? 'إنشاء بروفايل جديد' : 'تعديل البروفايل'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted hover:text-text"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={handleSaveForm}
                        className="px-4 py-1.5 rounded-xl bg-accent text-bg font-bold text-xs flex items-center gap-1.5 hover:brightness-110 shadow-sm"
                      >
                        <Save size={14} />
                        حفظ التغييرات
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-text mb-1">اسم البروفايل / المستخدم</label>
                      <input
                        type="text"
                        dir="auto"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="مثال: بروفايل ابن خلدون المخصص"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text mb-1">الشخصية المرتبطة</label>
                      <select
                        value={editForm.personaId || ''}
                        onChange={(e) => setEditForm({ ...editForm, personaId: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                      >
                        {Object.keys(personas).map(pKey => (
                          <option key={pKey} value={pKey}>
                            {pKey} ({personas[pKey]?.label})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text mb-1">وصف البروفايل والأهداف</label>
                      <textarea
                        dir="auto"
                        rows={2}
                        value={editForm.bio || ''}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        placeholder="أهداف التخصيص أو تفضيلات الاستجابة..."
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Parameters */}
                    <div className="p-4 rounded-2xl border border-border bg-surface/60 space-y-3">
                      <div className="text-xs font-bold text-accent flex items-center gap-2">
                        <Settings size={14} />
                        معلمات الشخصية المستهدفة (Persona Parameters)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-muted mb-1">الصوت الصوتي (TTS Voice)</label>
                          <select
                            value={editForm.parameters?.voice || 'Puck'}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              parameters: { ...editForm.parameters, voice: e.target.value }
                            })}
                            className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text"
                          >
                            {(dynamicVoices || DEFAULT_30_VOICES).map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-muted mb-1">نمط الاستدلال والتحليل</label>
                          <input
                            type="text"
                            dir="auto"
                            value={editForm.parameters?.reasoningStyle || 'منطقي تحليلي'}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              parameters: { ...editForm.parameters, reasoningStyle: e.target.value }
                            })}
                            className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Data Sources */}
                    <div className="p-4 rounded-2xl border border-border bg-surface/60 space-y-3">
                      <div className="text-xs font-bold text-accent flex items-center gap-2">
                        <Database size={14} />
                        مصادر البيانات والمعارف المرفقة (Data Sources)
                      </div>

                      <div className="space-y-2">
                        {(editForm.dataSources || []).map(ds => (
                          <div key={ds.id} className="p-2.5 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={14} className="text-accent shrink-0" />
                              <div>
                                <div className="font-bold text-text truncate">{ds.name}</div>
                                <div className="text-[10px] text-muted truncate">{ds.snippet || 'لا يوجد مقتطف'}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveDataSource(ds.id)}
                              className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-surface2"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            dir="auto"
                            placeholder="اسم المرجع / الكتاب / الوثيقة"
                            value={newDsName}
                            onChange={(e) => setNewDsName(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text col-span-2"
                          />
                          <select
                            value={newDsType}
                            onChange={(e) => setNewDsType(e.target.value as any)}
                            className="bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text"
                          >
                            <option value="text">نص مخصص</option>
                            <option value="pdf">وثيقة PDF</option>
                            <option value="note">ملاحظة بحثية</option>
                            <option value="url">رابط خارجي</option>
                          </select>
                        </div>
                        <textarea
                          dir="auto"
                          rows={2}
                          placeholder="المقتطف المعرفي أو الملخص المرجعي لتوجيه الشخصية..."
                          value={newDsSnippet}
                          onChange={(e) => setNewDsSnippet(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text"
                        />
                        <button
                          onClick={handleAddDataSource}
                          disabled={!newDsName.trim()}
                          className="px-3 py-1.5 rounded-xl bg-accent/20 border border-accent/40 text-accent font-bold text-xs hover:bg-accent/30 disabled:opacity-50 transition-all flex items-center gap-1"
                        >
                          <Plus size={14} />
                          إضافة مصدر معرفي للبروفايل
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : currentProfile ? (
                /* DETAIL VIEW */
                <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Top Banner */}
                  <div className="p-5 rounded-3xl border border-accent/30 bg-gradient-to-r from-accent/10 via-surface to-surface p-5 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-text">{currentProfile.name}</h3>
                        <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2.5 py-0.5 rounded-full font-bold">
                          {currentProfile.personaId}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1 max-w-xl">{currentProfile.bio || 'لا يوجد وصف مخصص لهذا البروفايل'}</p>
                      <div className="text-[10px] text-muted font-mono mt-2">
                        تاريخ الإنشاء: {currentProfile.createdAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartEdit(currentProfile)}
                        className="px-3.5 py-2 rounded-2xl bg-surface border border-border text-text hover:border-accent text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Edit3 size={14} />
                        تعديل البروفايل
                      </button>
                      <button
                        onClick={() => setProfileToDeleteId(currentProfile.id)}
                        className="p-2 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition-all cursor-pointer"
                        title="حذف البروفايل"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Parameters Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-border bg-surface/60 space-y-2">
                      <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                        <Settings size={14} />
                        المعلمات والموجهات الخاصة
                      </div>
                      <div className="text-xs space-y-1 text-muted">
                        <div>الصوت المفضل: <span className="text-text font-bold">{currentProfile.parameters?.voice || 'افتراضي'}</span></div>
                        <div>طابع الاستدلال: <span className="text-text font-bold">{currentProfile.parameters?.reasoningStyle || 'قياسي'}</span></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-border bg-surface/60 space-y-2">
                      <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                        <Database size={14} />
                        إحصائيات المعارف والمحفوظات
                      </div>
                      <div className="text-xs space-y-1 text-muted">
                        <div>عدد مصادر البيانات: <span className="text-text font-bold">{currentProfile.dataSources?.length || 0}</span></div>
                        <div>الجلسات المحفوظة: <span className="text-text font-bold">{currentProfile.savedSessions?.length || 0}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Data Sources List */}
                  <div className="p-5 rounded-2xl border border-border bg-surface/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-text flex items-center gap-2">
                        <Database size={16} className="text-accent" />
                        مصادر البيانات المرفقة ({currentProfile.dataSources?.length || 0})
                      </div>
                      <button
                        onClick={() => handleStartEdit(currentProfile)}
                        className="text-[11px] text-accent hover:underline"
                      >
                        + إدارة المصادر
                      </button>
                    </div>

                    {(!currentProfile.dataSources || currentProfile.dataSources.length === 0) ? (
                      <div className="p-6 text-center text-xs text-muted border border-dashed border-border rounded-xl">
                        لا توجد مصادر بيانات مرفقة بهذا البروفايل حتى الآن.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentProfile.dataSources.map(ds => (
                          <div key={ds.id} className="p-3 rounded-xl border border-border/80 bg-surface/80 space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-accent shrink-0" />
                              <span className="font-bold text-xs text-text truncate">{ds.name}</span>
                            </div>
                            {ds.snippet && (
                              <p className="text-[11px] text-muted line-clamp-2">{ds.snippet}</p>
                            )}
                            <div className="text-[9px] text-muted font-mono pt-1 border-t border-border/40">
                              تاريخ الإضافة: {ds.addedAt}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Saved Sessions Section */}
                  <div className="p-5 rounded-2xl border border-border bg-surface/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-text flex items-center gap-2">
                        <History size={16} className="text-accent" />
                        سجل المحادثات والجلسات المحفوظة ({currentProfile.savedSessions?.length || 0})
                      </div>

                      {currentChatMessages && currentChatMessages.length > 0 && (
                        <button
                          onClick={() => handleSaveCurrentSessionToProfile(currentProfile)}
                          className="px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/40 text-accent font-bold text-xs hover:bg-accent/25 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Save size={13} />
                          حفظ الجلسة الحالية لهذا البروفايل
                        </button>
                      )}
                    </div>

                    {(!currentProfile.savedSessions || currentProfile.savedSessions.length === 0) ? (
                      <div className="p-6 text-center text-xs text-muted border border-dashed border-border rounded-xl">
                        لم يتم حفظ أي جلسة محادثة في هذا البروفايل بعد.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentProfile.savedSessions.map(sess => (
                          <div key={sess.id} className="p-3 rounded-xl border border-border bg-surface flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <MessageSquare size={16} className="text-accent shrink-0" />
                              <div className="overflow-hidden">
                                <div className="font-bold text-xs text-text truncate">{sess.title}</div>
                                <div className="text-[10px] text-muted">
                                  {sess.messageCount} رسالة • {sess.savedAt}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => setSessionToDelete({ profile: currentProfile, sessionId: sess.id, title: sess.title })}
                              className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-surface2"
                              title="حذف الجلسة المحفوظة"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted text-xs gap-2">
                  <User size={32} className="opacity-40" />
                  <p>اختر بروفايل من القائمة الجانبية أو قم بإنشاء بروفايل جديد</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <ConfirmModal
        isOpen={!!profileToDeleteId}
        title="حذف البروفايل"
        message="هل أنت متأكد من رغبتك في حذف هذا البروفايل المخصص ومصادر بياناته نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="نعم، احذف البروفايل"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (profileToDeleteId) {
            onDeleteProfile(profileToDeleteId);
            setProfileToDeleteId(null);
          }
        }}
        onCancel={() => setProfileToDeleteId(null)}
      />

      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="حذف الجلسة المحفوظة"
        message={`هل أنت متأكد من رغبتك في حذف الجلسة "${sessionToDelete?.title || ''}" من البروفايل نهائياً؟`}
        confirmText="نعم، احذف الجلسة"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (sessionToDelete) {
            handleRemoveSession(sessionToDelete.profile, sessionToDelete.sessionId);
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </AnimatePresence>
  );
};
