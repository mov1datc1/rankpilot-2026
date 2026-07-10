'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowRight, Plus, Trash2, Loader2, Users, Building2,
  UserPlus, Briefcase, MessageSquare, Save
} from 'lucide-react';
import { updateSubmissionDepartment } from '@/app/actions/submissions';

// ── Types ──
type Contact = { name: string; email: string; phone: string };
type Hire = { name: string; status: string; firm: string };
type Lawyer = {
  name: string; url: string; currentRank: string; suggestedRank: string;
  focus: string; bio: string; standoutWork: string; isPartner: boolean; isRanked: boolean;
};

export default function DepartmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>}>
      <DepartmentContent />
    </Suspense>
  );
}

function DepartmentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const submissionId = searchParams.get('id') || '';

  // ── State ──
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', email: '', phone: '' }]);
  const [departmentName, setDepartmentName] = useState('');
  const [numPartners, setNumPartners] = useState(0);
  const [numLawyers, setNumLawyers] = useState(0);
  const [departmentHeads, setDepartmentHeads] = useState<Contact[]>([{ name: '', email: '', phone: '' }]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([{
    name: '', url: '', currentRank: 'Not Ranked', suggestedRank: '',
    focus: '', bio: '', standoutWork: '', isPartner: false, isRanked: false
  }]);
  const [departmentDesc, setDepartmentDesc] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Shared styles ──
  const sectionCard = {
    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '1.5rem', marginBottom: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };
  const sectionHeader = (icon: React.ReactNode, title: string, sub: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{sub}</p>
      </div>
    </div>
  );
  const inputStyle = { padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem', width: '100%' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: 600 as const, color: '#6B7280', textTransform: 'uppercase' as const, marginBottom: '0.2rem' };
  const addBtn = (onClick: () => void, label: string) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#f1f5f9', color: '#475569', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
      <Plus size={14} /> {label}
    </button>
  );
  const removeBtn = (onClick: () => void) => (
    <button onClick={onClick} style={{ padding: '0.35rem', background: '#FEE2E2', color: '#DC2626', borderRadius: '4px', border: 'none', cursor: 'pointer' }}><Trash2 size={12} /></button>
  );

  // ── Handlers ──
  const handleSave = async () => {
    if (!submissionId) { alert('Missing submission ID'); return; }
    setSaving(true);
    const result = await updateSubmissionDepartment(submissionId, {
      contacts, departmentName, numPartners, numLawyers,
      departmentHeads, hires, lawyers, departmentDesc, feedback,
    });
    setSaving(false);
    if (result.success) {
      router.push(`/submissions/builder?id=${submissionId}`);
    } else {
      alert('Error saving: ' + result.error);
    }
  };

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', padding: '0 0 4rem 0' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={28} style={{ color: '#2563eb' }} /> Department & Lawyers
        </h1>
        <p style={{ fontSize: '1rem', color: '#64748b', marginTop: '0.25rem' }}>
          Fill in Sections A4, B, and C of the Chambers template. These fields describe your firm, department, and lawyer profiles.
        </p>
      </div>

      {/* ═══ A4: Contacts ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<Users size={18} />, 'A4 — Contact Persons', 'People to arrange interviews about this practice area')}
        {contacts.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <input style={inputStyle} placeholder="Name" value={c.name} onChange={e => { const a = [...contacts]; a[i].name = e.target.value; setContacts(a); }} />
            <input style={inputStyle} placeholder="Email" value={c.email} onChange={e => { const a = [...contacts]; a[i].email = e.target.value; setContacts(a); }} />
            <input style={inputStyle} placeholder="Phone" value={c.phone} onChange={e => { const a = [...contacts]; a[i].phone = e.target.value; setContacts(a); }} />
            {contacts.length > 1 && removeBtn(() => setContacts(contacts.filter((_, j) => j !== i)))}
          </div>
        ))}
        {addBtn(() => setContacts([...contacts, { name: '', email: '', phone: '' }]), 'Add Contact')}
      </div>

      {/* ═══ B1-B3: Department Info ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<Building2 size={18} />, 'B1–B3 — Department Info', 'Name and team size')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Department Name</label>
            <input style={inputStyle} placeholder="e.g., Banking & Finance" value={departmentName} onChange={e => setDepartmentName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}># Partners</label>
            <input style={inputStyle} type="number" min={0} value={numPartners} onChange={e => setNumPartners(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}># Other Lawyers</label>
            <input style={inputStyle} type="number" min={0} value={numLawyers} onChange={e => setNumLawyers(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* ═══ B4: Department Heads ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<Briefcase size={18} />, 'B4 — Department Heads / Key Partners', 'Names and contact info')}
        {departmentHeads.map((h, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <input style={inputStyle} placeholder="Name" value={h.name} onChange={e => { const a = [...departmentHeads]; a[i].name = e.target.value; setDepartmentHeads(a); }} />
            <input style={inputStyle} placeholder="Email" value={h.email} onChange={e => { const a = [...departmentHeads]; a[i].email = e.target.value; setDepartmentHeads(a); }} />
            <input style={inputStyle} placeholder="Phone" value={h.phone} onChange={e => { const a = [...departmentHeads]; a[i].phone = e.target.value; setDepartmentHeads(a); }} />
            {departmentHeads.length > 1 && removeBtn(() => setDepartmentHeads(departmentHeads.filter((_, j) => j !== i)))}
          </div>
        ))}
        {addBtn(() => setDepartmentHeads([...departmentHeads, { name: '', email: '', phone: '' }]), 'Add Head')}
      </div>

      {/* ═══ B5: Hires / Departures ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<UserPlus size={18} />, 'B5 — Hires / Departures', 'Partner movements in the last 12 months')}
        {hires.length === 0 && <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>No hires or departures added yet.</p>}
        {hires.map((h, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <input style={inputStyle} placeholder="Name" value={h.name} onChange={e => { const a = [...hires]; a[i].name = e.target.value; setHires(a); }} />
            <select style={{ ...inputStyle, background: '#fff' }} value={h.status} onChange={e => { const a = [...hires]; a[i].status = e.target.value; setHires(a); }}>
              <option value="">— Select —</option>
              <option value="Joined">Joined</option>
              <option value="Departed">Departed</option>
            </select>
            <input style={inputStyle} placeholder="Firm name" value={h.firm} onChange={e => { const a = [...hires]; a[i].firm = e.target.value; setHires(a); }} />
            {removeBtn(() => setHires(hires.filter((_, j) => j !== i)))}
          </div>
        ))}
        {addBtn(() => setHires([...hires, { name: '', status: '', firm: '' }]), 'Add Hire/Departure')}
      </div>

      {/* ═══ B6: Lawyer Profiles ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<Users size={18} />, 'B6 — Lawyer Profiles', 'Ranked and unranked lawyers in this practice area')}
        {lawyers.map((l, i) => (
          <div key={i} style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', background: '#fafbfc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1A237E' }}>Lawyer #{i + 1}</span>
              {lawyers.length > 1 && removeBtn(() => setLawyers(lawyers.filter((_, j) => j !== i)))}
            </div>
            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={l.name} onChange={e => { const a = [...lawyers]; a[i].name = e.target.value; setLawyers(a); }} placeholder="Full name" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Bio URL</label>
                <input style={inputStyle} value={l.url} onChange={e => { const a = [...lawyers]; a[i].url = e.target.value; setLawyers(a); }} placeholder="https://..." />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Current Rank</label>
                <select style={{ ...inputStyle, background: '#fff' }} value={l.currentRank} onChange={e => { const a = [...lawyers]; a[i].currentRank = e.target.value; setLawyers(a); }}>
                  <option>Not Ranked</option>
                  <option>Band 1</option><option>Band 2</option><option>Band 3</option><option>Band 4</option><option>Band 5</option>
                  <option>Up and Coming</option><option>Associates to Watch</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Suggested Rank</label>
                <select style={{ ...inputStyle, background: '#fff' }} value={l.suggestedRank} onChange={e => { const a = [...lawyers]; a[i].suggestedRank = e.target.value; setLawyers(a); }}>
                  <option value="">—</option>
                  <option>Band 1</option><option>Band 2</option><option>Band 3</option><option>Band 4</option><option>Band 5</option>
                  <option>Up and Coming</option><option>Associates to Watch</option>
                </select>
              </div>
            </div>
            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Key Areas of Focus</label>
                <textarea style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontFamily: 'inherit' }} value={l.focus} onChange={e => { const a = [...lawyers]; a[i].focus = e.target.value; setLawyers(a); }} placeholder="e.g., Project finance, cross-border M&A" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={labelStyle}>Standout Recent Work</label>
                <textarea style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontFamily: 'inherit' }} value={l.standoutWork} onChange={e => { const a = [...lawyers]; a[i].standoutWork = e.target.value; setLawyers(a); }} placeholder="Describe notable matters..." />
              </div>
            </div>
            {/* Row 3: Checkboxes */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={l.isPartner} onChange={e => { const a = [...lawyers]; a[i].isPartner = e.target.checked; setLawyers(a); }} style={{ accentColor: '#2563eb' }} /> Partner
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={l.isRanked} onChange={e => { const a = [...lawyers]; a[i].isRanked = e.target.checked; setLawyers(a); }} style={{ accentColor: '#2563eb' }} /> Currently Ranked
              </label>
            </div>
          </div>
        ))}
        {addBtn(() => setLawyers([...lawyers, { name: '', url: '', currentRank: 'Not Ranked', suggestedRank: '', focus: '', bio: '', standoutWork: '', isPartner: false, isRanked: false }]), 'Add Lawyer')}
      </div>

      {/* ═══ B7: Department Description ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<Building2 size={18} />, 'B7 — What is this department best known for?', 'Industry expertise, key work types, recent growth (500 words max)')}
        <textarea
          value={departmentDesc}
          onChange={e => setDepartmentDesc(e.target.value)}
          placeholder="Describe the department's strengths, industry focus, and recent growth areas..."
          style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: departmentDesc.split(/\s+/).filter(Boolean).length > 500 ? '#dc2626' : '#94a3b8', marginTop: '0.25rem' }}>
          {departmentDesc.split(/\s+/).filter(Boolean).length} / 500 words
        </div>
      </div>

      {/* ═══ C2: Feedback ═══ */}
      <div style={sectionCard}>
        {sectionHeader(<MessageSquare size={18} />, 'C2 — Feedback on Coverage', 'Optional — your feedback on Chambers coverage of this practice area')}
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="We would be happy to discuss the market during a telephone interview."
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
      </div>

      {/* ═══ Actions ═══ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button
          onClick={() => router.push(`/submissions/builder?id=${submissionId}`)}
          style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
        >
          Skip for Now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem',
            background: saving ? '#94a3b8' : '#1A237E', color: '#fff',
            borderRadius: '8px', border: 'none', cursor: saving ? 'wait' : 'pointer',
            fontWeight: 600, fontSize: '0.95rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        >
          {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save & Continue to Matters <ArrowRight size={16} /></>}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
