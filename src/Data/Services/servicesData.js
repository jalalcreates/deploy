import servicesJSON from "./services.json";

/**
 * Flatten all services into a single searchable array
 * Each service includes its category for better context
 */
export function getAllServices() {
  const allServices = [];

  Object.entries(servicesJSON.categories).forEach(([categoryKey, category]) => {
    category.services.forEach((service) => {
      allServices.push({
        name: service,
        category: category.displayName,
        categoryKey,
      });
    });
  });

  return allServices;
}

/**
 * Get unique service names only (for simple dropdown)
 */
export function getServiceNames() {
  return getAllServices().map((s) => s.name);
}

/**
 * Search services by query (case-insensitive partial match)
 * @param {string} query - Search query
 * @param {number} limit - Maximum results to return (default: 10)
 */
export function searchServices(query, limit = 10) {
  if (!query || query.trim().length === 0) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const allServices = getAllServices();

  // Exact matches first
  const exactMatches = allServices.filter((service) =>
    service.name.toLowerCase() === normalizedQuery
  );

  // Starts with matches
  const startsWithMatches = allServices.filter(
    (service) =>
      service.name.toLowerCase().startsWith(normalizedQuery) &&
      !exactMatches.includes(service)
  );

  // Contains matches
  const containsMatches = allServices.filter(
    (service) =>
      service.name.toLowerCase().includes(normalizedQuery) &&
      !exactMatches.includes(service) &&
      !startsWithMatches.includes(service)
  );

  // Category matches (service is in a category that matches)
  const categoryMatches = allServices.filter(
    (service) =>
      service.category.toLowerCase().includes(normalizedQuery) &&
      !exactMatches.includes(service) &&
      !startsWithMatches.includes(service) &&
      !containsMatches.includes(service)
  );

  // Combine and limit results
  return [...exactMatches, ...startsWithMatches, ...containsMatches, ...categoryMatches].slice(
    0,
    limit
  );
}

/**
 * Get services by category
 */
export function getServicesByCategory(categoryKey) {
  return servicesJSON.categories[categoryKey]?.services || [];
}

/**
 * Get all categories
 */
export function getAllCategories() {
  return Object.entries(servicesJSON.categories).map(([key, category]) => ({
    key,
    name: category.displayName,
    serviceCount: category.services.length,
  }));
}
