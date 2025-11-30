// src/Utils/React-Query/provider.js
"use client"; // This directive is CRUCIAL for this file to be a Client Component

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export const queryClient = new QueryClient();

export function ReactQueryProvider({ children }) {
  // const [queryClient] = useState(
  //   () =>
  //     new QueryClient({
  //       defaultOptions: {
  //         queries: {
  //           staleTime: 5 * 60 * 1000, // 5 minutes
  //           refetchOnWindowFocus: false, // Prevents refetching on window focus by default
  //         },
  //       },
  //     })
  // );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
