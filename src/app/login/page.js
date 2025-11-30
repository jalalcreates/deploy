// src/components/Auth.js
"use client";
import { useState } from "react";
import LoginForm from "@/Components/Login/login";
import SignupForm from "@/Components/Signup/signup";
import styles from "./loginForm.module.css";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className={styles.container}>
      {isLogin ? (
        <LoginForm toggleForm={toggleForm} />
      ) : (
        <SignupForm toggleForm={toggleForm} />
      )}
    </div>
  );
}
