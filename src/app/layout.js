import localFont from "next/font/local";
import "./globals.css";
import TokenRenewal from "@/Utils/AccessToken/token";
import { cookies } from "next/headers";
import { UserDataProvider } from "@/Context/context";
import { SocketProvider } from "@/Context/SocketContext";
import { getUserData } from "@/Data/User/user";
import { ReactQueryProvider } from "@/Utils/React-Query/provider";
import Taskbar from "@/Components/Taskbar/taskbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Side Project",
  description: "Just trying to make money",
};

export default async function RootLayout({ children }) {
  const rt = await cookies().get("refreshToken");
  const at = await cookies().get("accessToken");
  const { user } = await getUserData(at?.value);
  const plainUser = JSON.parse(JSON.stringify(user));

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <TokenRenewal rt={rt && rt} />
        <ReactQueryProvider>
          <UserDataProvider initialUserData={plainUser && plainUser}>
            <SocketProvider initialUserData={plainUser && plainUser}>
              <Taskbar
                userData={
                  plainUser && {
                    username: plainUser.username,
                    currentCity: plainUser.currentCity,
                  }
                }
              />
              {children}
            </SocketProvider>
          </UserDataProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
