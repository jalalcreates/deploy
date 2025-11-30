// app/[username]/page.js
import { getUserProfile } from "@/Actions/User/user";
import ProfilePage from "./profileClient";

export default async function ProfileServer({ params }) {
  const { username } = await params;
  const res = await getUserProfile(username);

  if (!res.success) {
    return <div>User not found</div>;
  }

  return <ProfilePage initialUser={res.plainUser} />;
}
