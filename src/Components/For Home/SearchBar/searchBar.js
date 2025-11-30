import styles from "./searchBar.module.css";

export default function SearchBar() {
  return (
    <div className={styles.searchBar}>
      <div className={styles.searchContainer}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search for freelancers, services, or skills..."
        />
      </div>
    </div>
  );
}
