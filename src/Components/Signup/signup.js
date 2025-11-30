// src/components/SignupForm.js
import { signUp } from "@/Actions/Authentication/SignUp/signup";
import styles from "@/app/login/loginForm.module.css";

export default function SignupForm({ toggleForm }) {
  return (
    <div className={styles.formContainer}>
      <h1 className="heading">Sign Up</h1>
      <form action={signUp}>
        <div className={styles.inputGroup}>
          <label htmlFor="username">Username</label>
          <input name="username" type="text" id="username" required />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="password">Password</label>
          <input name="password" type="password" id="password" required />
        </div>
        <button type="submit" className={styles.submitButton}>
          Sign Up
        </button>
      </form>
      <p className={styles.toggleText}>
        Already have an account?{" "}
        <span onClick={toggleForm} className={styles.toggleLink}>
          Login
        </span>
      </p>
    </div>
  );
}
