"use client";
import { useState } from "react";
import ServiceRequest from "../Service_Request/servicerequest";
import styles from "./serviceButton.module.css";

export default function ServiceButton() {
  const [requestForm, setRequestForm] = useState(false);
  const handleBackdropClick = (e) => {
    if (e.target.className === styles.pageContainer) {
      setRequestForm(false);
    }
  };
  return (
    <div className={styles.floatingAction}>
      <button onClick={() => setRequestForm(true)} className={styles.actionBtn}>
        + Need service
      </button>
      {requestForm && (
        <div className={styles.pageContainer} onClick={handleBackdropClick}>
          <ServiceRequest closeForm={() => setRequestForm(false)} />
        </div>
      )}
    </div>
  );
}
