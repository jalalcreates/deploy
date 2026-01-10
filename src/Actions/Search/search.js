"use server";

import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { searchServices } from "@/Data/Services/servicesData";

/**
 * Search for freelancers by username or name
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object} - Search results
 */
export async function searchFreelancers(query, options = {}) {
  try {
    const {
      limit = 10,
      city = null,
      minRating = 0,
      sortBy = "averageStars",
      sortOrder = "desc",
    } = options;

    // Validate query
    if (!query || query.trim().length === 0) {
      return { success: true, freelancers: [], count: 0 };
    }

    // Connect to database
    try {
      await connectDb();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return {
        success: false,
        error: "Database connection failed",
        freelancers: [],
        count: 0,
      };
    }

    const normalizedQuery = query.trim();

    // Build search criteria
    const searchCriteria = {
      isFreelancer: true,
      $or: [
        { username: { $regex: normalizedQuery, $options: "i" } },
        { name: { $regex: normalizedQuery, $options: "i" } },
      ],
    };

    // Add optional filters
    if (city) {
      searchCriteria.$or.push({ currentCity: city }, { citiesToWorkIn: city });
    }

    if (minRating > 0) {
      searchCriteria.averageStars = { $gte: minRating };
    }

    // Build sort criteria
    const sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute search with projection
    const freelancers = await User.find(searchCriteria, {
      username: 1,
      name: 1,
      profilePicture: 1,
      expertise: 1,
      averageStars: 1,
      currentCity: 1,
      citiesToWorkIn: 1,
      "customers.satisfiedCustomers": 1,
      recommended: 1,
      workExperience: 1,
    })
      .sort(sortCriteria)
      .limit(limit)
      .lean()
      .exec();

    // Serialize for client
    const serializedFreelancers = JSON.parse(JSON.stringify(freelancers));

    return {
      success: true,
      freelancers: serializedFreelancers,
      count: serializedFreelancers.length,
    };
  } catch (error) {
    console.error("Error in searchFreelancers:", error);
    return {
      success: true, // Changed to true to allow graceful handling
      error: error.message || "Failed to search freelancers",
      freelancers: [],
      count: 0,
    };
  }
}

/**
 * Search for freelancers by service/expertise
 * @param {string} service - Service name
 * @param {object} options - Filter options
 * @returns {object} - Matching freelancers
 */
export async function searchFreelancersByService(service, options = {}) {
  try {
    const {
      limit = 50,
      city = null,
      minRating = 0,
      sortBy = "averageStars",
      sortOrder = "desc",
    } = options;

    if (!service || service.trim().length === 0) {
      return { success: true, freelancers: [], count: 0 };
    }

    // Connect to database
    try {
      await connectDb();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return {
        success: true,
        error: "Database connection failed",
        freelancers: [],
        count: 0,
      };
    }

    const normalizedService = service.trim();

    // Build search criteria
    const searchCriteria = {
      isFreelancer: true,
      expertise: { $regex: normalizedService, $options: "i" },
    };

    // Add optional filters
    if (city) {
      searchCriteria.$or = [{ currentCity: city }, { citiesToWorkIn: city }];
    }

    if (minRating > 0) {
      searchCriteria.averageStars = { $gte: minRating };
    }

    // Build sort criteria
    const sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute search
    const freelancers = await User.find(searchCriteria, {
      username: 1,
      name: 1,
      profilePicture: 1,
      expertise: 1,
      averageStars: 1,
      currentCity: 1,
      citiesToWorkIn: 1,
      "customers.satisfiedCustomers": 1,
      recommended: 1,
      workExperience: 1,
    })
      .sort(sortCriteria)
      .limit(limit)
      .lean()
      .exec();

    const serializedFreelancers = JSON.parse(JSON.stringify(freelancers));

    return {
      success: true,
      freelancers: serializedFreelancers,
      count: serializedFreelancers.length,
      service: normalizedService,
    };
  } catch (error) {
    console.error("Error in searchFreelancersByService:", error);
    return {
      success: true, // Changed to true for graceful handling
      error: error.message || "Failed to search freelancers by service",
      freelancers: [],
      count: 0,
    };
  }
}

/**
 * Combined search - searches both freelancers and services
 * This is optimized to run a single database query
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object} - Combined search results
 */
export async function combinedSearch(query, options = {}) {
  try {
    if (!query || query.trim().length < 2) {
      return {
        success: true,
        freelancers: [],
        services: [],
        freelancersCount: 0,
        servicesCount: 0,
      };
    }

    // Search services locally (no DB call needed)
    let services = [];
    try {
      services = searchServices(query, options.servicesLimit || 10) || [];
    } catch (serviceError) {
      console.error("Error searching services:", serviceError);
      services = [];
    }

    // Search freelancers in database
    let freelancersResult = { freelancers: [], count: 0, success: true };
    try {
      freelancersResult = await searchFreelancers(query, {
        limit: options.freelancersLimit || 10,
        city: options.city,
        minRating: options.minRating,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
      });
    } catch (freelancerError) {
      console.error("Error searching freelancers:", freelancerError);
      freelancersResult = { freelancers: [], count: 0, success: true };
    }

    return {
      success: true,
      freelancers: freelancersResult.freelancers || [],
      services: services || [],
      freelancersCount: freelancersResult.count || 0,
      servicesCount: services.length || 0,
    };
  } catch (error) {
    console.error("Error in combinedSearch:", error);
    return {
      success: true, // Always return success: true for graceful handling
      error: error.message || "Failed to perform search",
      freelancers: [],
      services: [],
      freelancersCount: 0,
      servicesCount: 0,
    };
  }
}

/**
 * Get all cities where freelancers are available
 * This is used for city filter dropdown
 */
export async function getAvailableCities() {
  try {
    try {
      await connectDb();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return {
        success: true,
        cities: [],
      };
    }

    const cities = await User.distinct("currentCity", { isFreelancer: true });

    return {
      success: true,
      cities: cities.filter(Boolean).sort(),
    };
  } catch (error) {
    console.error("Error in getAvailableCities:", error);
    return {
      success: true, // Changed to true for graceful handling
      error: error.message,
      cities: [],
    };
  }
}
