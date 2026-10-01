import { useEffect, useState } from 'react';
import { Check, Info, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { createTeamMember, deleteTeamMember, getTeamMembers, updateTeamMember } from '../api';

const emptyMember = { name: '', email: '', phone: '', role: 'staff', status: 'invited', notes: '' };
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

  useEffect(() => {
    loadMembers();
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

  const visibleMembers = members.filter((entry) => (
    `${entry.name} ${entry.email} ${entry.role}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const updateField = (event) => {
    const { name, value } = event.target;
    setMember((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setMember(emptyMember);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...member, name: member.name.trim() };

    try {
      const saved = editingId
        ? await updateTeamMember(editingId, payload)
        : await createTeamMember(payload);

      setMembers((current) => editingId
        ? current.map((entry) => String(entry.id) === String(saved.id) ? saved : entry)
        : [...current, saved].sort((first, second) => first.name.localeCompare(second.name)));
      setStatusMessage(`${saved.name} ${editingId ? 'updated' : 'added'} successfully`);
      resetForm();
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
    } catch (error) {
      setErrorMessage(error.message || 'Unable to remove team member');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Your team</p>
          <h1>Users &amp; roles</h1>
          <p>Keep a roster of who has a role in your business and what they're responsible for.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
        </div>
      </div>

      <p className="roster-note"><Info size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />This is a contact roster for tracking roles, not a login invitation — team members listed here don't yet get their own sign-in to this account.</p>

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
              <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="5">Loading team members…</td></tr>
              ) : visibleMembers.length ? visibleMembers.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.name}</strong></td>
                  <td><span>{entry.email || '—'}</span>{entry.phone && <small className="supplier-contact-email">{entry.phone}</small>}</td>
                  <td><span className={`badge ${roleTone[entry.role] || 'teal'}`}>{entry.role}</span></td>
                  <td><span className={`badge ${statusTone[entry.status] || 'gold'}`}>{entry.status}</span></td>
                  <td className="table-actions supplier-table-actions">
                    <button className="icon-button" type="button" onClick={() => beginEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil size={15} /></button>
                    <button className="icon-button danger" type="button" onClick={() => handleDelete(entry)} aria-label={`Remove ${entry.name}`}><Trash2 size={15} /></button>
                  </td>
                </tr>
              )) : (
                <tr><td className="empty-products" colSpan="5">{searchTerm ? 'No team members match your search.' : 'No team members yet. Add your first one above.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {statusMessage && <div className="success-toast" role="status"><Check size={16} /> {statusMessage}</div>}
      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

export { UsersRolesPage };
