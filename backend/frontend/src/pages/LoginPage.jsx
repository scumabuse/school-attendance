import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const user = await loginUser(login, password);
      // Если пользователь - студент, перенаправляем на /student
      if (user.role === 'STUDENT') {
        navigate("/student");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Ошибка авторизации");
    }
  }

  return (
    <div className="loginpage">
      <div className="login-container">
        <form onSubmit={handleSubmit} className="login-card">
          <h2>Вход</h2>

          <input
            type="text"
            placeholder="Логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="login-input"
          />

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button">Войти</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
