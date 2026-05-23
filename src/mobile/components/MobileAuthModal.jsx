import { useState } from "react";

export function MobileAuthModal({ mode, onClose, onLogin, onRegister, submitting, error }) {
  const [loginForm, setLoginForm] = useState({ account: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  if (!mode) return null;

  const onSubmitLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.account || !loginForm.password) return;
    await onLogin(loginForm.account, loginForm.password);
  };

  const onSubmitRegister = async (e) => {
    e.preventDefault();
    const { username, email, password, confirmPassword } = registerForm;
    if (!username || !email || !password) return;
    if (password.length < 6) return;
    if (password !== confirmPassword) return;
    await onRegister(username, email, password);
  };

  return (
    <div className="m-auth-mask" role="dialog" aria-modal="true">
      <div className="m-auth-modal">
        <div className="m-btn-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{mode === "login" ? "登录" : "注册"}</h2>
          <button type="button" className="m-btn m-btn--ghost" onClick={onClose} disabled={submitting}>
            关闭
          </button>
        </div>
        {error ? <p className="m-error">{error}</p> : null}
        {mode === "login" ? (
          <form className="m-form" onSubmit={onSubmitLogin}>
            <label>
              账号（用户名或邮箱）
              <input
                value={loginForm.account}
                onChange={(e) => setLoginForm((p) => ({ ...p, account: e.target.value }))}
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="m-btn m-btn--primary" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "登录中…" : "登录"}
            </button>
          </form>
        ) : (
          <form className="m-form" onSubmit={onSubmitRegister}>
            <label>
              用户名
              <input
                value={registerForm.username}
                onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))}
              />
            </label>
            <label>
              邮箱
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <label>
              确认密码
              <input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              />
            </label>
            <button type="submit" className="m-btn m-btn--primary" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "注册中…" : "注册"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
