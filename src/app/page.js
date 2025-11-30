import FreelancersInCity from "@/Components/For Home/Freelancers/freelancers";
import styles from "./page.module.css";
import ServiceRequest from "@/Components/For Home/Service_Request/servicerequest";
import Link from "next/link";
import OrdersSidebar from "@/Components/For Home/OrdersSidebar/ordersSidebar";
import Taskbar from "@/Components/Taskbar/taskbar";
import ServiceButton from "@/Components/For Home/ServiceButton/serviceButton";
import SearchBar from "@/Components/For Home/SearchBar/searchBar";

async function Home() {
  // COMPONENTS TO MAKE:
  // 1. Search bar (where user can search for the desired service.)
  // 2. Bottom navbar (where user can navigate between user. It will persist for all pages.)
  // 3. Button to make a service request (the user's request will be seen by freelancers in their city.)

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
