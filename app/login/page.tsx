export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Access the library</p>
        <h1>Welcome to EJC Physics</h1>
        <p>EJC users will sign in with Google. External visitors can use read-only demo access.</p>

        <button className="auth-button google" type="button" disabled>
          Continue with Google
          <small>Firebase connection comes in the next build step</small>
        </button>

        <div className="divider"><span>or</span></div>

        <label className="field-label" htmlFor="demo-password">Demo password</label>
        <input id="demo-password" className="text-field" type="password" placeholder="Enter demo password" disabled />
        <button className="auth-button" type="button" disabled>Enter demo</button>

        <p className="auth-note">Demo access will be read-only and will never grant contributor or admin permissions.</p>
      </section>
    </main>
  );
}
