import { ChangeEvent, FormEvent, useMemo, useState } from "react";

interface Host {
  id: number;
  name: string;
  department: string;
  email: string;
  phone: string;
  location: string;
}

const SAMPLE_HOSTS: Host[] = [
  { id: 1, name: "Anaya Singh", department: "People Ops", email: "anaya.singh@example.com", phone: "+91 98765 43210", location: "Tower A - Level 11" },
  { id: 2, name: "David Chen", department: "Engineering", email: "d.chen@example.com", phone: "+1 415 555 0192", location: "Innovation Lab" },
  { id: 3, name: "Ishita Rao", department: "Facilities", email: "ishita.rao@example.com", phone: "+91 99880 11223", location: "Reception HQ" },
  { id: 4, name: "Leo Martins", department: "Security", email: "leo.martins@example.com", phone: "+44 20 1234 5670", location: "Security Hub" },
];

type HostFormState = Omit<Host, "id">;

const DEFAULT_FORM: HostFormState = {
  name: "",
  department: "",
  email: "",
  phone: "",
  location: "",
};

export function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>(SAMPLE_HOSTS);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<HostFormState>(DEFAULT_FORM);

  const filteredHosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return hosts;
    }
    return hosts.filter((host) =>
      [host.name, host.department, host.email, host.location].some((value) => value.toLowerCase().includes(term))
    );
  }, [hosts, search]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    if (editingId) {
      setHosts((previous) =>
        previous.map((host) => (host.id === editingId ? { ...host, ...form } : host))
      );
    } else {
      const nextId = Math.max(0, ...hosts.map((host) => host.id)) + 1;
      setHosts((previous) => [...previous, { id: nextId, ...form }]);
    }

    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function handleEdit(host: Host) {
    setEditingId(host.id);
    setForm({
      name: host.name,
      department: host.department,
      email: host.email,
      phone: host.phone,
      location: host.location,
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Remove this host?") ) {
      return;
    }
    setHosts((previous) => previous.filter((host) => host.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(DEFAULT_FORM);
    }
  }

  return (
    <div className="hosts-page">
      <section className="hosts-header">
        <div>
          <h2>Host directory</h2>
          <p>Keep department contacts updated so visitor notifications reach the right person instantly.</p>
        </div>
        <div className="hosts-actions">
          <input
            type="search"
            placeholder="Search hosts, departments, locations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setForm(DEFAULT_FORM);
            }}
          >
            Add host
          </button>
        </div>
      </section>

      <div className="hosts-layout">
        <div className="host-grid">
          {filteredHosts.map((host) => (
            <article key={host.id} className="host-card">
              <header>
                <h3>{host.name}</h3>
                <span className="badge badge-outline">{host.department}</span>
              </header>
              <dl>
                <div>
                  <dt>Email</dt>
                  <dd>{host.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{host.phone}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{host.location}</dd>
                </div>
              </dl>
              <footer>
                <button type="button" className="btn btn-ghost" onClick={() => handleEdit(host)}>
                  Edit
                </button>
                <button type="button" className="btn btn-ghost danger" onClick={() => handleDelete(host.id)}>
                  Remove
                </button>
              </footer>
            </article>
          ))}
          {filteredHosts.length === 0 && (
            <div className="empty-state">No hosts match your search.</div>
          )}
        </div>

        <aside className="host-form-card">
          <h3>{editingId ? "Edit host" : "Add new host"}</h3>
          <p>Capture host details to route visitor notifications and approvals automatically.</p>
          <form onSubmit={handleSubmit} className="host-form">
            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Full name"
                required
              />
            </label>
            <label>
              Department
              <input
                name="department"
                value={form.department}
                onChange={handleInputChange}
                placeholder="Team or department"
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                placeholder="name@example.com"
                required
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                placeholder="Contact number"
                required
              />
            </label>
            <label>
              Location
              <input
                name="location"
                value={form.location}
                onChange={handleInputChange}
                placeholder="Meeting room or zone"
                required
              />
            </label>
            <div className="host-form__actions">
              {editingId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(DEFAULT_FORM);
                  }}
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Create host"}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
