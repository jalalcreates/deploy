"use server";
import User from "@/Database/Schemas/User/user";

export async function getFreelancersInCity(user, skip, limit) {
  try {
    if (!user) return { success: false };
    const allFreelancers = await User.find({ username: "test" });
    // const allFreelancers = await User.aggregate([
    //   {
    //     $match: {
    //       freelancer: true,
    //       currentCity: user?.currentCity,
    //     },
    //   },
    //   { $limit: limit },
    //   { $skip: skip },
    //   { $sort: { averageStars: -1 } },
    // ]);
    const finalFreelancers = JSON.parse(JSON.stringify(allFreelancers));

    return { freelancers: finalFreelancers, success: true };
  } catch (error) {
    console.log(`Error in getFreelancersInCity() : ${error}`);
  }
}
