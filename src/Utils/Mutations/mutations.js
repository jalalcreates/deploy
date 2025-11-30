// 📁 lib/mutations.js

import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/Utils/React-Query/provider";
export function useCreateOrderMutation() {
  return useMutation({
    mutationFn: async ({ formData }) => {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create order");
      return res.json();
    },
    onMutate: async ({ formData, optimisticOrder }) => {
      await queryClient.cancelQueries({ queryKey: ["ordersGiven"] });
      const previousOrders = queryClient.getQueryData(["ordersGiven"]);

      queryClient.setQueryData(["ordersGiven"], (old) => [
        ...(old || []),
        optimisticOrder,
      ]);
      return { previousOrders };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["ordersGiven"], context.previousOrders);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersGiven"] });
    },
  });
}

export function useNegotiateOrder(onRespond) {
  return useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/orders/negotiation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Negotiation failed");
      return res.json();
    },

    onSuccess: ({ updatedOrders }) => {
      console.log(updatedOrders);
      if (onRespond) {
        onRespond(updatedOrders);
      }
    },

    onError: (err) => {
      console.error("Negotiation failed:", err);
      alert("Negotiation failed. Try again.");
    },
  });
}
