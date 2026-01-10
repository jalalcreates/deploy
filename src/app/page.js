import FreelancersInCity from "@/Components/For Home/Freelancers/freelancers";
import styles from "./page.module.css";
import ServiceRequest from "@/Components/For Home/Service_Request/servicerequest";
import Link from "next/link";
import OrdersSidebar from "@/Components/For Home/OrdersSidebar/ordersSidebar";
import Taskbar from "@/Components/Taskbar/taskbar";
import ServiceButton from "@/Components/For Home/ServiceButton/serviceButton";
import SearchBar from "@/Components/For Home/SearchBar/searchBar";

async function Home() {
  return (
    <>
      <SearchBar />
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Find Local Services Near You</h1>
          <p className={styles.heroDescription}>
            Connect with skilled professionals in your city. Browse verified freelancers,
            request services, and get the help you need.
          </p>
        </div>
      </div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Available Freelancers</h2>
        <p className={styles.sectionSubtitle}>Browse professionals in your area</p>
      </div>
      <FreelancersInCity />
      <OrdersSidebar />
      <ServiceButton />
    </>
  );
}

export default Home;
