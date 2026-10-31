export function AuthCard({ title, lead, children }: { title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="auth-card">
      <h1>{title}</h1>
      {lead && <p className="auth-lead">{lead}</p>}
      {children}
    </div>
  );
}
