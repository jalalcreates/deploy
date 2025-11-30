// src/components/LoginForm.js
import { login } from "@/Actions/Authentication/Login/login";
import styles from "@/app/login/loginForm.module.css";

export default function LoginForm({ toggleForm }) {
  return (
    <div className={styles.formContainer}>
      <h1 className="heading">Login</h1>
      <form action={login}>
        <div className={styles.inputGroup}>
          <label htmlFor="username">Email</label>
          <input name="username" type="text" id="username" required />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="password">Password</label>
          <input name="password" type="password" id="password" required />
        </div>
        <button type="submit" className={styles.submitButton}>
          Login
        </button>
      </form>
      <p className={styles.toggleText}>
        Don't have an account?{" "}
        <span onClick={toggleForm} className={styles.toggleLink}>
          Sign Up
        </span>
      </p>
    </div>
  );
}
