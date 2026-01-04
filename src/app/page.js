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
      <FreelancersInCity />
      <OrdersSidebar />
      <ServiceButton />
    </>
  );
}

export default Home;
