export function SignOutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="nav-button" type="submit">Sign out</button>
    </form>
  );
}
