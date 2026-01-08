"use client";

import { useUserData } from "@/Context/context";
import { useEffect, useRef, useState, useCallback } from "react";
import { getFreelancersInCity } from "@/Actions/GET REQUESTS/Freelancers/freelancers";
import styles from "./freelancers.module.css";
import FreelancerCard from "../FreelancerCard/freelancerCard";
import GiveOrderModal from "../GiveOrderModal/ordermodal";

export default function FreelancersInCity() {
  const { initialUserData: user } = useUserData();
  const [page, setPage] = useState(1);
  const [freelancers, setFreelancers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const observerRef = useRef(null);
  const loaderRef = useRef(null);

  const limit = 30;

  const fetchData = useCallback(async () => {
    if (!user?.currentCity) return;

    const skip = (page - 1) * limit;
    const { freelancers: newFreelancers, success } = await getFreelancersInCity(
      user,
      skip,
      limit
    );
    if (success && Array.isArray(newFreelancers)) {
      setFreelancers((prev) => [...prev, ...newFreelancers]);
    }
  }, [page, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      {
        rootMargin: "200px",
      }
    );

    observer.observe(loaderRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current && loaderRef.current) {
        observerRef.current.unobserve(loaderRef.current);
      }
    };
  }, [loaderRef.current]);

  const handleGiveOrder = (freelancer) => {
    setSelectedFreelancer(freelancer);
    setIsModalOpen(true);
  };

  return (
    <div className={styles.mainLayout}>
      <div className={styles.mainContent}>
        <div className={styles.freelancerGrid}>
          {freelancers.map((freelancer, index) => (
            <FreelancerCard
              key={index}
              freelancer={freelancer}
              onGiveOrder={handleGiveOrder}
            />
          ))}
        </div>
        <div ref={loaderRef} style={{ height: "1px", marginTop: "20px" }}></div>
      </div>

      <GiveOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        freelancer={selectedFreelancer}
        clientUsername={user?.username}
        clientProfilePicture={user?.profilePicture}
      />
    </div>
  );
}
