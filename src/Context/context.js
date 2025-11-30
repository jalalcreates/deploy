"use client";
import { createContext, useContext } from "react";
const UserDataContext = createContext();

export const UserDataProvider = ({ children, initialUserData }) => {
  // console.log({ initialUserData });
  return (
    <UserDataContext.Provider value={{ initialUserData }}>
      {children}
    </UserDataContext.Provider>
  );
};

export function useUserData() {
  return useContext(UserDataContext);
}
