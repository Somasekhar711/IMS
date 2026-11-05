import { useEffect, useState } from 'react';
import { Check, Clock, Copy, Info, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { createTeamMember, deleteTeamMember, getActivityLog, getTeamMembers, resetTeamMemberPassword, updateTeamMember } from '../api';
import { PERMISSION_MODULES, emptyPermissions } from '../permissionModules';

const emptyMember = { name: '', email: '', phone: '', role: 'staff', status: 'invited', notes: '', enableLogin: false, empId: '', permissions: emptyPermissions() };
const roleTone = { admin: 'purple', manager: 'blue', staff: 'teal' };
const statusTone = { active: 'green', invited: 'gold' };

function UsersRolesPage() {
  const [members, setMembers] = useState([]);
  const [member, setMember] = useState(emptyMember);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tempPasswordNotice, setTempPasswordNotice] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  useEffect(() => {
    loadMembers();
    loadActivity();
  }, []);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return undefined;
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage, errorMessage]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      setMembers(await getTeamMembers());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivity = async () => {
    setIsActivityLoading(true);
    try {
      setActivityLog(await getActivityLog({ limit: 20 }));
    } catch {
      // Non-critical for the roster view.
    } finally {
      setIsActivityLoading(false);
    }
  };

  const visibleMembers = members.filter((entry) => (
    `${entry.name} ${entry.email} ${entry.role}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const updateField = (event) => {
    const { name, value } = event.target;
    setMember((current) => ({ ...current, [name]: value }));
  };

  const updatePermission = (moduleKey, level) => {
    setMember((current) => ({ ...current, permissions: { ...current.permissions, [moduleKey]: level } }));
  };

  const resetForm = () => {
    setMember(emptyMember);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...member, name: member.name.trim(), empId: member.empId.trim() };

    try {
      const saved = editingId
        ? await updateTeamMember(editingId, payload)
        : await createTeamMember(payload);

      setMembers((current) => editingId
        ? current.map((entry) => String(entry.id) === String(saved.id) ? saved : entry)
        : [...current, saved].sort((first, second) => first.name.localeCompare(second.name)));
      setStatusMessage(`${saved.name} ${editingId ? 'updated' : 'added'} successfully`);
      if (saved.tempPassword) {
        setTempPasswordNotice({ name: saved.name, empId: saved.empId, password: saved.tempPassword });
      }
      resetForm();
      loadActivity();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save team member');
    }
  };

  const beginEdit = (entry) => {
    setEditingId(entry.id);
    setMember({
      name: entry.name,
      email: entry.email || '',
      phone: entry.phone || '',
      role: entry.role,
      status: entry.status,
      notes: entry.notes || '',
      enableLogin: entry.hasLogin,
      empId: entry.empId || '',
      permissions: { ...emptyPermissions(), ...entry.permissions },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove "${entry.name}" from the team roster?`)) return;

    try {
      await deleteTeamMember(entry.id);
      setMembers((current) => current.filter((item) => String(item.id) !== String(entry.id)));
      if (String(editingId) === String(entry.id)) resetForm();
      setStatusMessage(`${entry.name} removed successfully`);
      loadActivity();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to remove team member');
    }
  };

  const handleResetPassword = async (entry) => {
    if (!window.confirm(`Generate a new temporary password for "${entry.name}"? Their current password will stop working.`)) return;

    try {
      const saved = await resetTeamMemberPassword(entry.id, {
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        role: entry.role,
        status: entry.status,
        notes: entry.notes,
        enableLogin: true,
        empId: entry.empId,
        permissions: entry.permissions,
      });
      setMembers((current) => current.map((item) => String(item.id) === String(saved.id) ? saved : item));
      if (saved.tempPassword) {
        setTempPasswordNotice({ name: saved.name, empId: saved.empId, password: saved.tempPassword });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to reset password');
    }
  };

  const copyTempPassword = () => {
    if (!tempPasswordNotice) return;
    navigator.clipboard?.writeText(tempPasswordNotice.password).catch(() => {});
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Your team</p>
          <h1>Users &amp; roles</h1>
          <p>Keep a roster of who has a role in your business, and optionally grant them their own sign-in with per-module permissions.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
        </div>
      </div>

      <p className="roster-note"><Info size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />Team members are contacts by default. Check "Grant login access" to give them their own employee sign-in, scoped to the permissions you choose below.</p>

      <section className="product-panel panel supplier-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Team member</p>
            <h2>{editingId ? 'Update team member' : 'Add team member'}</h2>
          </div>
          {editingId ? <Pencil size={19} color="#63866f" /> : <Plus size={20} color="#63866f" />}
        </div>

        <form className="product-form supplier-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input name="name" value={member.name} onChange={updateField} placeholder="Full name" required maxLength={120} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" value={member.email} onChange={updateField} placeholder="name@company.com" type="email" maxLength={255} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" value={member.phone} onChange={updateField} placeholder="Phone number" type="tel" maxLength={40} />
          </label>
          <label className="field">
            <span>Role</span>
            <select name="role" value={member.role} onChange={updateField}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={member.status} onChange={updateField}>
              <option value="invited">Invited</option>
              <option value="active">Active</option>
            </select>
          </label>
          <label className="field supplier-notes-field">
            <span>Notes</span>
            <input name="notes" value={member.notes} onChange={updateField} placeholder="Optional notes" />
          </label>

          <div className="field supplier-notes-field toggle-row">
            <div><strong>Grant login access</strong><span>Give this person their own employee sign-in to this workspace</span></div>
            <label className="toggle-switch">
              <input type="checkbox" checked={member.enableLogin} onChange={(event) => setMember((current) => ({ ...current, enableLogin: event.target.checked }))} />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
          </div>

          {member.enableLogin && (
            <>
              <label className="field">
                <span>Employee ID</span>
                <input name="empId" value={member.empId} onChange={updateField} placeholder="EMP001" required maxLength={40} />
              </label>

              <fieldset className="supplier-product-picker permission-grid supplier-notes-field">
                <legend>Permissions</legend>
                <div className="permission-grid__rows">
                  {PERMISSION_MODULES.map(({ key, label }) => (
                    <div className="permission-grid__row" key={key}>
                      <span>{label}</span>
                      <div className="permission-grid__options">
                        {['none', 'read', 'write'].map((level) => (
                          <label key={level} className={`permission-chip ${member.permissions[key] === level ? 'is-active' : ''}`}>
                            <input
                              type="radio"
                              name={`permission-${key}`}
                              checked={member.permissions[key] === level}
                              onChange={() => updatePermission(key, level)}
                            />
                            {level === 'none' ? 'None' : level === 'read' ? 'Read' : 'Write'}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          <div className="supplier-form-actions">
            {editingId && (
              <button type="button" className="secondary-action" onClick={resetForm}>
                <X size={15} /> Cancel
              </button>
            )}
            <button className="submit-button product-submit" type="submit">
              {editingId ? <Pencil size={15} /> : <Plus size={15} />}
              {editingId ? 'Save member' : 'Add member'}
            </button>
          </div>
        </form>
      </section>

      {tempPasswordNotice && (
        <div className="modal-backdrop" onMouseDown={() => setTempPasswordNotice(null)}>
          <section className="edit-modal panel temp-password-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div><p className="eyebrow">Share with {tempPasswordNotice.name}</p><h2>Temporary password</h2></div>
              <button className="icon-button" onClick={() => setTempPasswordNotice(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <p>This password is shown once. Share it with the employee securely — they'll be asked to set their own on first sign-in.</p>
            <div className="temp-password-box">
              <div><small>Employee ID</small><strong>{tempPasswordNotice.empId}</strong></div>
              <div><small>Temporary password</small><strong>{tempPasswordNotice.password}</strong></div>
              <button type="button" className="secondary-action" onClick={copyTempPassword}><Copy size={14} /> Copy password</button>
            </div>
            <button className="submit-button product-submit" type="button" onClick={() => setTempPasswordNotice(null)}>Done</button>
          </section>
        </div>
      )}

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p className="eyebrow">Roster</p>
            <h2>Team members</h2>
          </div>
          <label className="product-search">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search team members" aria-label="Search team members" />
          </label>
        </div>

        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Login</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="6">Loading team members…</td></tr>
              ) : visibleMembers.length ? visibleMembers.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.name}</strong></td>
                  <td><span>{entry.email || '—'}</span>{entry.phone && <small className="supplier-contact-email">{entry.phone}</small>}</td>
                  <td><span className={`badge ${roleTone[entry.role] || 'teal'}`}>{entry.role}</span></td>
                  <td><span className={`badge ${statusTone[entry.status] || 'gold'}`}>{entry.status}</span></td>
                  <td>{entry.hasLogin ? <span className="badge teal"><ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />{entry.empId}</span> : <span className="empty-hint">—</span>}</td>
                  <td className="table-actions supplier-table-actions">
                    {entry.hasLogin && <button className="icon-button" type="button" onClick={() => handleResetPassword(entry)} aria-label={`Reset password for ${entry.name}`}><KeyRound size={15} /></button>}
                    <button className="icon-button" type="button" onClick={() => beginEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil size={15} /></button>
                    <button className="icon-button danger" type="button" onClick={() => handleDelete(entry)} aria-label={`Remove ${entry.name}`}><Trash2 size={15} /></button>
                  </td>
                </tr>
              )) : (
                <tr><td className="empty-products" colSpan="6">{searchTerm ? 'No team members match your search.' : 'No team members yet. Add your first one above.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="product-panel panel settings-card full activity-log-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Audit trail</p><h2>Recent activity</h2></div>
          <Clock size={19} color="#63866f" />
        </div>
        {isActivityLoading ? (
          <p className="empty-hint">Loading activity…</p>
        ) : activityLog.length ? (
          <ul className="activity-log-list">
            {activityLog.map((entry) => (
              <li key={entry.id}>
                <span className={`badge ${entry.actorType === 'admin' ? 'purple' : 'blue'}`}>{entry.actorType}</span>
                <div className="activity-log-copy">
                  <strong>{entry.actorName}</strong>
                  <span>{entry.description}</span>
                </div>
                <time>{new Date(entry.createdAt).toLocaleString('en-IN')}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">No activity recorded yet.</p>
        )}
      </section>

      {statusMessage && <div className="success-toast" role="status"><Check size={16} /> {statusMessage}</div>}
      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

export { UsersRolesPage };
