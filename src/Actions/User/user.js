"use server";

import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function getUserProfile(username) {
  try {
    await connectDb();

    if (!username) {
      return { success: false, error: "Username is required" };
    }

    const user = await User.findOne({ username })
      .select("-password") // Exclude password
      .lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const plainUser = JSON.parse(JSON.stringify(user));

    return {
      success: true,
      plainUser,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return {
      success: false,
      error: "Failed to fetch user profile",
    };
  }
}

// Helper function to save image to filesystem
async function saveImageToFileSystem(
  base64Data,
  category,
  oldImagePath = null
) {
  try {
    // Extract base64 data and mime type
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 string");
    }

    const mimeType = matches[1];
    const base64Image = matches[2];

    // Validate image type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(mimeType)) {
      throw new Error(
        "Invalid image type. Only JPEG, PNG, and WebP are allowed"
      );
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image, "base64");

    // Validate image size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (imageBuffer.length > maxSize) {
      throw new Error("Image size exceeds 5MB limit");
    }

    // Determine file extension
    const extension = mimeType.split("/")[1];

    // Generate unique filename
    const prefix = category === "profilePictures" ? "profile" : "degree";
    const uniqueFileName = `${prefix}_${uuidv4()}.${extension}`;

    // Create directory path
    const imageDir = path.join(process.cwd(), "public", "images", category);

    // Ensure directory exists
    await mkdir(imageDir, { recursive: true });

    // Full file path
    const filePath = path.join(imageDir, uniqueFileName);

    // Write file
    await writeFile(filePath, imageBuffer);

    // Delete old image if exists
    if (oldImagePath) {
      try {
        const oldFilePath = path.join(process.cwd(), "public", oldImagePath);
        await unlink(oldFilePath);
      } catch (error) {
        console.warn("Could not delete old image:", error.message);
      }
    }

    // Return relative path for database storage
    return `/images/${category}/${uniqueFileName}`;
  } catch (error) {
    console.error("Error saving image:", error);
    throw new Error(`Failed to save image: ${error.message}`);
  }
}

export async function updateUserProfile({
  username,
  fieldChanged,
  action,
  data,
  index = null,
}) {
  console.log({ action, fieldChanged, index });

  try {
    await connectDb();

    if (!username || !fieldChanged) {
      return { success: false, error: "Username and field are required" };
    }

    const user = await User.findOne({ username });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    let updateOperation = {};
    let savedImagePath = null;

    // Handle different field types with ATOMIC OPERATIONS
    switch (fieldChanged) {
      case "profilePicture":
        // Check if data.value is base64 or already a URL
        if (data.value && data.value.startsWith("data:")) {
          // Save new image
          savedImagePath = await saveImageToFileSystem(
            data.value,
            "profilePictures",
            user.profilePicture
          );
          updateOperation = { $set: { profilePicture: savedImagePath } };
        } else if (data.value === "") {
          // Remove profile picture
          if (user.profilePicture) {
            try {
              const oldFilePath = path.join(
                process.cwd(),
                "public",
                user.profilePicture
              );
              await unlink(oldFilePath);
            } catch (error) {
              console.warn("Could not delete old image:", error.message);
            }
          }
          updateOperation = { $set: { profilePicture: "" } };
        } else {
          // Use existing path
          updateOperation = { $set: { profilePicture: data.value } };
        }
        break;

      case "name":
        updateOperation = { $set: { name: data } };
        break;

      case "currentCity":
        updateOperation = { $set: { currentCity: data } };
        break;

      case "expertise":
        if (action === "add") {
          // Use $addToSet to prevent duplicates
          updateOperation = { $addToSet: { expertise: data } };
        } else if (action === "remove" && index !== null) {
          // Use $pull to remove by index
          const expertiseToRemove = user.expertise[index];
          updateOperation = { $pull: { expertise: expertiseToRemove } };
        } else if (action === "update" && index !== null) {
          // Update specific array element using positional operator
          updateOperation = { $set: { [`expertise.${index}`]: data } };
        }
        break;

      case "citiesToWorkIn":
        if (action === "add") {
          updateOperation = { $addToSet: { citiesToWorkIn: data } };
        } else if (action === "remove" && index !== null) {
          const cityToRemove = user.citiesToWorkIn[index];
          updateOperation = { $pull: { citiesToWorkIn: cityToRemove } };
        } else if (action === "update" && index !== null) {
          updateOperation = { $set: { [`citiesToWorkIn.${index}`]: data } };
        }
        break;

      case "workExperience":
        if (action === "add") {
          // Validate required fields
          if (
            !data.organization ||
            !data.designation ||
            !data.experience ||
            !data.experienceSpan
          ) {
            return {
              success: false,
              error: "All work experience fields are required",
            };
          }
          updateOperation = { $push: { workExperience: data } };
        } else if (action === "remove" && index !== null) {
          // Remove by index using $unset and $pull
          updateOperation = {
            $pull: { workExperience: user.workExperience[index] },
          };
        } else if (action === "update" && index !== null) {
          // Update specific array element
          updateOperation = {
            $set: {
              [`workExperience.${index}.organization`]: data.organization,
              [`workExperience.${index}.designation`]: data.designation,
              [`workExperience.${index}.experience`]: data.experience,
              [`workExperience.${index}.experienceSpan`]: data.experienceSpan,
            },
          };
        }
        break;

      case "degrees":
        if (action === "add") {
          // Validate required fields
          if (!data.institute || !data.degree) {
            return {
              success: false,
              error: "Institute and degree name are required",
            };
          }

          // Handle proof image if provided
          let proofPath = "";
          if (data.proof && data.proof.startsWith("data:")) {
            proofPath = await saveImageToFileSystem(data.proof, "degrees");
          }

          const degreeData = {
            institute: data.institute,
            degree: data.degree,
            proof: proofPath,
          };

          updateOperation = { $push: { degrees: degreeData } };
        } else if (action === "remove" && index !== null) {
          // Delete proof image if exists
          const degreeToRemove = user.degrees[index];
          if (degreeToRemove.proof) {
            try {
              const proofFilePath = path.join(
                process.cwd(),
                "public",
                degreeToRemove.proof
              );
              await unlink(proofFilePath);
            } catch (error) {
              console.warn("Could not delete degree proof:", error.message);
            }
          }
          updateOperation = { $pull: { degrees: degreeToRemove } };
        } else if (action === "update" && index !== null) {
          // Handle proof image update
          let proofPath = user.degrees[index].proof;

          if (data.proof && data.proof.startsWith("data:")) {
            // New proof image uploaded
            proofPath = await saveImageToFileSystem(
              data.proof,
              "degrees",
              user.degrees[index].proof
            );
          } else if (data.proof === "") {
            // Remove existing proof
            if (user.degrees[index].proof) {
              try {
                const oldProofPath = path.join(
                  process.cwd(),
                  "public",
                  user.degrees[index].proof
                );
                await unlink(oldProofPath);
              } catch (error) {
                console.warn("Could not delete old proof:", error.message);
              }
            }
            proofPath = "";
          }

          updateOperation = {
            $set: {
              [`degrees.${index}.institute`]: data.institute,
              [`degrees.${index}.degree`]: data.degree,
              [`degrees.${index}.proof`]: proofPath,
            },
          };
        }
        break;

      default:
        return { success: false, error: "Invalid field" };
    }

    // Execute atomic update
    const updatedUser = await User.findOneAndUpdate(
      { username },
      updateOperation,
      { new: true, select: "-password" }
    ).lean();

    if (!updatedUser) {
      return { success: false, error: "Failed to update user" };
    }

    return {
      success: true,
      user: JSON.parse(JSON.stringify(updatedUser)),
      message: "Profile updated successfully",
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: error.message || "Failed to update profile",
    };
  }
}

export async function becomeFreelancer(username) {
  try {
    await connectDb();

    if (!username) {
      return { success: false, error: "Username is required" };
    }

    const user = await User.findOneAndUpdate(
      { username },
      {
        $set: { isFreelancer: true },
        $setOnInsert: {
          expertise: [],
          citiesToWorkIn: [],
          workExperience: [],
          degrees: [],
        },
      },
      { new: true, select: "-password" }
    ).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: JSON.parse(JSON.stringify(user)),
      message: "You are now a freelancer!",
    };
  } catch (error) {
    console.error("Error updating freelancer status:", error);
    return {
      success: false,
      error: "Failed to become freelancer",
    };
  }
}
