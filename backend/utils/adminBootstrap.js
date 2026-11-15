/**
 * First-admin bootstrap for a fresh database.
 *
 * If ADMIN_EMAILS (comma-separated) is set AND no admin exists yet, a user
 * who registers or logs in with one of those emails is made admin. Once any
 * admin exists this does nothing, so a stranger cannot later register a
 * listed address (registration has no email verification) and gain admin.
 */
function parseAdminEmails(value) {
  return (value || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function maybeBootstrapAdmin(user, { User, adminEmails = process.env.ADMIN_EMAILS } = {}) {
  const allowed = parseAdminEmails(adminEmails);
  if (!user || user.role === 'admin' || allowed.length === 0) return false;
  if (!allowed.includes(String(user.email).toLowerCase())) return false;
  const existingAdmin = await User.exists({ role: 'admin' });
  if (existingAdmin) return false;
  user.role = 'admin';
  return true;
}

module.exports = { maybeBootstrapAdmin, parseAdminEmails };
