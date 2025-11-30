// // /app/client-root.jsx

// import { ReactQueryProvider } from "@/Utils/React-Query/provider";
// import { UserDataProvider } from "@/Context/context";
// import TokenRenewal from "@/Utils/AccessToken/token";

// export default function ClientRoot({ children, plainUser, rt }) {
//   return (
//     <ReactQueryProvider>
//       <UserDataProvider initialUserData={plainUser}>
//         <TokenRenewal rt={rt} />
//         {children}
//       </UserDataProvider>
//     </ReactQueryProvider>
//   );
// }
