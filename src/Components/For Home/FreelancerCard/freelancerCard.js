import styles from "./freelancerCard.module.css";
import { HiMapPin, HiClock, HiCheckBadge } from "react-icons/hi2";

export default function FreelancerCard({ freelancer, onGiveOrder }) {
  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`${styles.star} ${
          i < Math.floor(rating || 0) ? styles.starFilled : ""
        }`}
      >
        ★
      </span>
    ));
  };

  const handleGiveOrder = () => {
    if (onGiveOrder) {
      onGiveOrder(freelancer);
    }
  };

  return (
    <div className={styles.freelancerCard}>
      <div className={styles.freelancerHeader}>
        <div className={styles.freelancerAvatar}>
          {freelancer.profilePicture ? (
            <img src={freelancer.profilePicture} alt={freelancer.username} />
          ) : (
            <div className={styles.freelancerAvatarFallback}>
              {freelancer.username[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className={styles.freelancerNameSection}>
          <h3 className={styles.freelancerName}>{freelancer.username}</h3>
          {freelancer.certified && (
            <span className={styles.certifiedBadge}>
              <HiBadgeCheck className={styles.badgeIcon} /> Certified
            </span>
          )}
        </div>
      </div>

      <div className={styles.freelancerMeta}>
        <div className={styles.metaItem}>
          <HiMapPin className={styles.metaIcon} />
          <span className={styles.metaText}>
            {freelancer.currentCity || "Unknown"}
          </span>
        </div>
        <div className={styles.metaItem}>
          <HiClock className={styles.metaIcon} />
          <span className={styles.metaText}>
            {freelancer.workExperience?.length
              ? `${freelancer.workExperience.reduce(
                  (acc, exp) => acc + exp.experience,
                  0
                )} yrs`
              : "N/A"}
          </span>
        </div>
      </div>

      <div className={styles.starRating}>
        {renderStars(freelancer.averageStars)}
        <span className={styles.ratingNumber}>
          {freelancer.averageStars?.toFixed(1) || "0.0"}
        </span>
      </div>

      <div className={styles.servicesSection}>
        <p className={styles.servicesLabel}>Main Services</p>
        <div className={styles.servicesList}>
          {freelancer.expertise?.map((service, idx) => (
            <span key={idx} className={styles.serviceBadge}>
              {service}
            </span>
          ))}
        </div>
      </div>

      <button className={styles.giveOrderBtn} onClick={handleGiveOrder}>
        Give Order
      </button>
    </div>
  );
}
