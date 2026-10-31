import { Form } from "@/components/Form";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireStaff } from "@/lib/session";
import { passwordAction } from "../../actions";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const { staff } = await requireStaff();
  return (
    <>
      <h1 className="title">My account</h1>
      <p className="hint">{staff.username} · {ROLE_LABEL[staff.role]}. To replace your authenticator, ask the owner to reset your account.</p>
      <section className="card" style={{ marginTop: 20, maxWidth: 560 }}>
        <h2 className="sub">Change password</h2>
        <Form action={passwordAction} className="stack" reset>
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="field" /></div>
          <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} className="field" /></div>
          <div><label className="label" htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" /></div>
          <button type="submit" className="btn btn-primary" style={{ justifySelf: "start" }}>Change password</button>
        </Form>
      </section>
    </>
  );
}
