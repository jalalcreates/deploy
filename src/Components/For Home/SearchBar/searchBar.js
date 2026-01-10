"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import styles from "./SearchBar.module.css";
import { useDebounce, useDebouncedCallback } from "@/hooks/useDebounce";
import {
  combinedSearch,
  searchFreelancersByService,
  getAvailableCities,
} from "@/Actions/Search/search";
import { HiMagnifyingGlass, HiChevronRight } from "react-icons/hi2";

export default function SearchBar() {
  // Search state
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState({
    freelancers: [],
    services: [],
    freelancersCount: 0,
    servicesCount: 0,
  });
  const [isSearching, setIsSearching] = useState(false);

  // Service modal state
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceFreelancers, setServiceFreelancers] = useState([]);
  const [isLoadingServiceFreelancers, setIsLoadingServiceFreelancers] =
    useState(false);

  // Filter state
  const [filterCity, setFilterCity] = useState("");
  const [filterRating, setFilterRating] = useState(0);
  const [availableCities, setAvailableCities] = useState([]);

  // Sort state
  const [sortBy, setSortBy] = useState("averageStars");

  // Debounce search query
  const debouncedQuery = useDebounce(query, 400);

  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Load available cities on mount
  useEffect(() => {
    const loadCities = async () => {
      const result = await getAvailableCities();
      if (result.success && isMountedRef.current) {
        setAvailableCities(result.cities);
      }
    };
    loadCities();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setSearchResults({
          freelancers: [],
          services: [],
          freelancersCount: 0,
          servicesCount: 0,
        });
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const result = await combinedSearch(debouncedQuery, {
          freelancersLimit: 10,
          servicesLimit: 10,
        });

        if (isMountedRef.current) {
          // Always update results regardless of success flag
          setSearchResults({
            freelancers: result.freelancers || [],
            services: result.services || [],
            freelancersCount: result.freelancersCount || 0,
            servicesCount: result.servicesCount || 0,
          });
        }
      } catch (error) {
        console.error("Search error:", error);
        // On error, set empty results
        if (isMountedRef.current) {
          setSearchResults({
            freelancers: [],
            services: [],
            freelancersCount: 0,
            servicesCount: 0,
          });
        }
      } finally {
        // ALWAYS reset isSearching, no matter what
        if (isMountedRef.current) {
          setIsSearching(false);
        }
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // Handle input change
  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(value.trim().length > 0);
  };

  // Handle freelancer click
  const handleFreelancerClick = () => {
    setQuery("");
    setShowDropdown(false);
  };

  // Handle service click - load freelancers for that service
  const handleServiceClick = async (service) => {
    setSelectedService(service.name);
    setShowServiceModal(true);
    setShowDropdown(false);
    setQuery("");
    setIsLoadingServiceFreelancers(true);

    try {
      const result = await searchFreelancersByService(service.name, {
        limit: 50,
        sortBy: "averageStars",
        sortOrder: "desc",
      });

      if (isMountedRef.current) {
        setServiceFreelancers(result.freelancers || []);
      }
    } catch (error) {
      console.error("Error loading service freelancers:", error);
      if (isMountedRef.current) {
        setServiceFreelancers([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingServiceFreelancers(false);
      }
    }
  };

  // Apply filters and sorting to service freelancers
  const filteredServiceFreelancers = serviceFreelancers
    .filter((freelancer) => {
      if (filterCity && freelancer.currentCity !== filterCity) {
        // Also check if city is in citiesToWorkIn
        if (!freelancer.citiesToWorkIn?.includes(filterCity)) {
          return false;
        }
      }
      if (filterRating && freelancer.averageStars < filterRating) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aValue =
        sortBy === "satisfiedCustomers"
          ? a.customers?.satisfiedCustomers || 0
          : sortBy === "recommended"
          ? a.recommended || 0
          : a.averageStars || 0;

      const bValue =
        sortBy === "satisfiedCustomers"
          ? b.customers?.satisfiedCustomers || 0
          : sortBy === "recommended"
          ? b.recommended || 0
          : b.averageStars || 0;

      return bValue - aValue; // Descending order
    });

  // Render stars helper
  const renderStars = (rating) => {
    const stars = [];
    const normalizedRating = rating || 0;
    for (let i = 0; i < 5; i++) {
      stars.push(
        <span key={i} className={styles.star}>
          {i < Math.floor(normalizedRating) ? "★" : "☆"}
        </span>
      );
    }
    return stars;
  };

  // Handle closing dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(`.${styles.searchContainer}`)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className={styles.searchBar}>
        <div className={styles.searchContainer}>
          <HiMagnifyingGlass className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search freelancers, services..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query.trim().length > 0 && setShowDropdown(true)}
          />
          {isSearching && (
            <span className={styles.searchingIndicator}>...</span>
          )}

          {showDropdown && query.trim().length >= 2 && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownContent}>
                {/* Freelancers Column */}
                <div className={styles.dropdownColumn}>
                  <div className={styles.columnHeader}>
                    <h4>Freelancers</h4>
                    {searchResults.freelancersCount > 0 && (
                      <span className={styles.resultCount}>
                        {searchResults.freelancersCount}
                      </span>
                    )}
                  </div>
                  <div className={styles.columnList}>
                    {searchResults.freelancers.length > 0 ? (
                      searchResults.freelancers.map((freelancer) => (
                        <Link
                          key={freelancer._id}
                          href={`/${freelancer.username}`}
                          onClick={handleFreelancerClick}
                        >
                          <div className={styles.resultItem}>
                            <img
                              src={
                                freelancer.profilePicture || "/placeholder.svg"
                              }
                              alt={freelancer.name || freelancer.username}
                              className={styles.resultAvatar}
                              onError={(e) => {
                                e.target.src = "/placeholder.svg";
                              }}
                            />
                            <div className={styles.resultInfo}>
                              <p className={styles.resultName}>
                                {freelancer.name || freelancer.username}
                              </p>
                              <p className={styles.resultDetail}>
                                {freelancer.currentCity || "No location"}
                              </p>
                              {freelancer.averageStars > 0 && (
                                <div className={styles.resultRating}>
                                  {renderStars(freelancer.averageStars)}
                                  <span className={styles.ratingText}>
                                    {freelancer.averageStars.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className={styles.noResultsMsg}>
                        {isSearching ? "Searching..." : "No freelancers found"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                {searchResults.servicesCount > 0 &&
                  searchResults.freelancersCount > 0 && (
                    <div className={styles.columnDivider}></div>
                  )}

                {/* Services Column */}
                <div className={styles.dropdownColumn}>
                  <div className={styles.columnHeader}>
                    <h4>Services</h4>
                    {searchResults.servicesCount > 0 && (
                      <span className={styles.resultCount}>
                        {searchResults.servicesCount}
                      </span>
                    )}
                  </div>
                  <div className={styles.columnList}>
                    {searchResults.services.length > 0 ? (
                      searchResults.services.map((service, idx) => (
                        <div
                          key={idx}
                          className={styles.serviceItem}
                          onClick={() => handleServiceClick(service)}
                        >
                          <div className={styles.serviceInfo}>
                            <p className={styles.serviceName}>{service.name}</p>
                            <p className={styles.serviceDetail}>
                              {service.category}
                            </p>
                          </div>
                          <HiChevronRight className={styles.arrow} />
                        </div>
                      ))
                    ) : (
                      <div className={styles.noResultsMsg}>
                        {isSearching ? "Searching..." : "No services found"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {searchResults.freelancersCount === 0 &&
                searchResults.servicesCount === 0 &&
                !isSearching && (
                  <div className={styles.noResultsContainer}>
                    <p className={styles.noResultsText}>
                      No results found for "{query}"
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Service Modal */}
      {showServiceModal && selectedService && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowServiceModal(false)}
        >
          <div
            className={styles.serviceModal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeBtn}
              onClick={() => setShowServiceModal(false)}
            >
              ✕
            </button>

            <div className={styles.serviceModalHeader}>
              <h2>{selectedService}</h2>
              <p className={styles.freelancerCount}>
                {filteredServiceFreelancers.length} freelancer
                {filteredServiceFreelancers.length !== 1 ? "s" : ""} available
              </p>
            </div>

            <div className={styles.filterOptions}>
              <div className={styles.filterGroup}>
                <label>City</label>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                >
                  <option value="">All Cities</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Minimum Rating</label>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(Number(e.target.value))}
                >
                  <option value={0}>All Ratings</option>
                  <option value={3}>3★ and up</option>
                  <option value={4}>4★ and up</option>
                  <option value={4.5}>4.5★ and up</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="averageStars">Highest Rating</option>
                  <option value="satisfiedCustomers">Most Customers</option>
                  <option value="recommended">Most Recommended</option>
                </select>
              </div>
            </div>

            {isLoadingServiceFreelancers ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Loading freelancers...</p>
              </div>
            ) : filteredServiceFreelancers.length > 0 ? (
              <div className={styles.serviceModalGrid}>
                {filteredServiceFreelancers.map((freelancer) => (
                  <div key={freelancer._id} className={styles.freelancerCard}>
                    <img
                      src={freelancer.profilePicture || "/placeholder.svg"}
                      alt={freelancer.name || freelancer.username}
                      className={styles.cardAvatar}
                      onError={(e) => {
                        e.target.src = "/placeholder.svg";
                      }}
                    />
                    <div className={styles.cardInfo}>
                      <h4>{freelancer.name || freelancer.username}</h4>
                      <p className={styles.cardUsername}>
                        @{freelancer.username}
                      </p>
                      <p className={styles.cardCity}>
                        {freelancer.currentCity || "Location not specified"}
                      </p>
                      {freelancer.averageStars > 0 && (
                        <div className={styles.cardRating}>
                          {renderStars(freelancer.averageStars)}
                          <span>{freelancer.averageStars.toFixed(1)}</span>
                        </div>
                      )}
                      {freelancer.customers?.satisfiedCustomers > 0 && (
                        <p className={styles.cardExperience}>
                          {freelancer.customers.satisfiedCustomers} satisfied
                          customer
                          {freelancer.customers.satisfiedCustomers !== 1
                            ? "s"
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/${freelancer.username}`}>
                        <button className={styles.viewBtn}>View Profile</button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noResultsContainer}>
                <p className={styles.noResultsText}>
                  No freelancers found
                  {filterCity || filterRating ? " with your filters" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
