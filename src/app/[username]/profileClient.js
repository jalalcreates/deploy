"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./profile.module.css";
import OrderModal from "@/Components/For Home/GiveOrderModal/ordermodal";
import { useUserData } from "@/Context/context";
import { becomeFreelancer, updateUserProfile } from "@/Actions/User/user";

export default function ProfilePage({ initialUser }) {
  const { initialUserData } = useUserData() || {};
  const params = useParams();
  const [user, setUser] = useState(initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isBecomeFreelancer, setIsBecomeFreelancer] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editingArrayIndex, setEditingArrayIndex] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  console.log(editingField, editFormData);
  if (!user) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingText}>User not found</div>
      </div>
    );
  }

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={
          i < Math.floor(rating) ? styles.starFilled : styles.starEmpty
        }
      >
        ★
      </span>
    ));
  };

  const isCurrentUser = initialUserData?.username === params.username;

  const openEditField = (field, index = null) => {
    setEditingField(field);
    setEditingArrayIndex(index);

    if (field === "profilePicture") {
      setEditFormData({ value: user.profilePicture });
      setShowEditModal(true);
      return;
    }

    if (index !== null && Array.isArray(user[field])) {
      setEditFormData(JSON.parse(JSON.stringify(user[field][index])));
    } else if (Array.isArray(user[field])) {
      setEditFormData({});
    } else {
      setEditFormData({ value: user[field] || "" });
    }
    setShowEditModal(true);
  };

  const saveEdit = async ({ isDelete = false }) => {
    console.log("Saving edit...");
    if (!editingField || isSaving) return;

    setIsSaving(true);

    // Store previous user state for rollback
    const previousUser = { ...user };

    // Perform optimistic update
    const updatedUser = { ...user };

    if (editingField === "profilePicture") {
      updatedUser.profilePicture = editFormData.value;
    } else if (editingArrayIndex !== null) {
      if (isDelete || Object.keys(editFormData).length === 0) {
        updatedUser[editingField] = user[editingField].filter(
          (_, i) => i !== editingArrayIndex
        );
      } else {
        const updatedArray = [...user[editingField]];
        updatedArray[editingArrayIndex] = editFormData;
        updatedUser[editingField] = updatedArray;
      }
    } else if (Array.isArray(user[editingField])) {
      if (Object.keys(editFormData).length > 0) {
        // For string arrays (expertise, cities)
        const dataToAdd =
          typeof editFormData === "string" ? editFormData : editFormData;
        updatedUser[editingField] = [...user[editingField], dataToAdd];
      }
    } else {
      updatedUser[editingField] = editFormData.value || "";
    }

    // Update UI optimistically
    setUser(updatedUser);
    setShowEditModal(false);

    try {
      const dataForUpdate = prepareEditData(
        editingField,
        editingArrayIndex,
        editFormData,
        editingArrayIndex === null && Array.isArray(user[editingField]),
        isDelete
      );
      console.log("Reached server call with data:", dataForUpdate);

      const result = await updateUserProfile(dataForUpdate);
      console.log("Reached below server call with data:", dataForUpdate);

      if (result.success) {
        setUser(result.user);
      } else {
        // Rollback on error
        setUser(previousUser);
        alert(result.error || "Failed to update profile");
      }
    } catch (error) {
      // Rollback on error
      setUser(previousUser);
      console.error("Update error:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
      setEditingField(null);
      setEditingArrayIndex(null);
      setEditFormData({});
    }
  };

  const prepareEditData = (
    field,
    index,
    data,
    isNewArrayItem,
    isDelete = false
  ) => {
    let action;

    if (isDelete) {
      action = "remove";
    } else if (index !== null) {
      action = Object.keys(data).length !== 0 && "update";
    } else if (isNewArrayItem) {
      action = "add";
    } else {
      action = "update";
    }

    return {
      username: user.username,
      fieldChanged: field,
      action,
      index,
      data: isDelete ? {} : data,
      timestamp: new Date().toISOString(),
    };
  };

  const handleBecomeFreelancer = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const previousUser = { ...user };
    const updatedUser = { ...user, isFreelancer: true };

    setUser(updatedUser);

    try {
      const result = await becomeFreelancer(user.username);
      console.log("Become freelancer result:", result);

      if (result.success) {
        setUser(result.user);
      } else {
        setUser(previousUser);
        alert(result.error || "Failed to become freelancer. Please try again.");
      }
    } catch (error) {
      console.error("Error while becoming freelancer:", error);
      setUser(previousUser);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditInputChange = (key, value) => {
    setEditFormData({
      ...editFormData,
      [key]: key === "experience" ? Number.parseInt(value) || 0 : value,
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditFormData({ value: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };
  console.log({ editFormData });
  const removeProfilePicture = () => {
    setEditFormData({ value: "" });
  };

  const renderEditModal = () => {
    if (!editingField) return null;

    const isArrayField = Array.isArray(user[editingField]);
    const isNewItem = editingArrayIndex === null && isArrayField;

    return (
      <div
        className={styles.modalOverlay}
        onClick={() => setShowEditModal(false)}
      >
        <SocketTest />
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3>
              {isNewItem
                ? `Add New ${editingField.slice(0, -1)}`
                : `Edit ${editingField}`}
            </h3>
            <button
              className={styles.closeBtn}
              onClick={() => setShowEditModal(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.modalContent}>
            {editingField === "profilePicture" && (
              <>
                <div className={styles.imageUploadContainer}>
                  <div className={styles.imagePreview}>
                    <img
                      src={
                        editFormData.value ||
                        "/placeholder.svg?height=150&width=150" ||
                        "/placeholder.svg"
                      }
                      alt="Profile Preview"
                      className={styles.previewImage}
                    />
                  </div>
                  <label
                    htmlFor="profilePictureInput"
                    className={styles.uploadLabel}
                  >
                    {editFormData.value ? "Change Picture" : "Upload Picture"}
                  </label>
                  <input
                    id="profilePictureInput"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.hiddenFileInput}
                  />
                  {editFormData.value &&
                    editFormData.value !== user.profilePicture && (
                      <button
                        type="button"
                        onClick={removeProfilePicture}
                        className={styles.removeImageBtn}
                      >
                        Remove Image
                      </button>
                    )}
                </div>
              </>
            )}

            {editingField === "expertise" && (
              <>
                <label>Skill/Expertise</label>
                <input
                  type="text"
                  value={typeof editFormData === "string" ? editFormData : ""}
                  onChange={(e) => setEditFormData(e.target.value)}
                  placeholder="e.g., Web Development"
                />
              </>
            )}

            {editingField === "citiesToWorkIn" && (
              <>
                <label>City Name</label>
                <input
                  type="text"
                  value={typeof editFormData === "string" ? editFormData : ""}
                  onChange={(e) => setEditFormData(e.target.value)}
                  placeholder="e.g., New York"
                />
              </>
            )}

            {editingField === "workExperience" && (
              <>
                <label>Job Title</label>
                <input
                  type="text"
                  value={editFormData.designation || ""}
                  onChange={(e) =>
                    handleEditInputChange("designation", e.target.value)
                  }
                  placeholder="Senior Designer"
                />
                <label>Organization</label>
                <input
                  type="text"
                  value={editFormData.organization || ""}
                  onChange={(e) =>
                    handleEditInputChange("organization", e.target.value)
                  }
                  placeholder="Design Co."
                />
                <label>Years of Experience</label>
                <input
                  type="number"
                  value={editFormData.experience || 0}
                  onChange={(e) =>
                    handleEditInputChange("experience", e.target.value)
                  }
                  placeholder="5"
                  min="0"
                />
                <label>Time Period</label>
                <input
                  type="text"
                  value={editFormData.experienceSpan || ""}
                  onChange={(e) =>
                    handleEditInputChange("experienceSpan", e.target.value)
                  }
                  placeholder="2019 - Present"
                />
              </>
            )}

            {editingField === "degrees" && (
              <>
                <label>Degree Name</label>
                <input
                  type="text"
                  value={editFormData.degree || ""}
                  onChange={(e) =>
                    handleEditInputChange("degree", e.target.value)
                  }
                  placeholder="Bachelor of Fine Arts in Graphic Design"
                />
                <label>Institute</label>
                <input
                  type="text"
                  value={editFormData.institute || ""}
                  onChange={(e) =>
                    handleEditInputChange("institute", e.target.value)
                  }
                  placeholder="New York University"
                />
                <label>Degree Proof (Optional)</label>
                <div className={styles.imageUploadContainer}>
                  {editFormData.proof && (
                    <div className={styles.imagePreview}>
                      <img
                        src={
                          editFormData.proof.startsWith("data:")
                            ? editFormData.proof
                            : editFormData.proof
                        }
                        alt="Degree Proof"
                        className={styles.previewImage}
                      />
                    </div>
                  )}
                  <label
                    htmlFor="degreeProofInput"
                    className={styles.uploadLabel}
                  >
                    {editFormData.proof ? "Change Proof" : "Upload Proof"}
                  </label>
                  <input
                    id="degreeProofInput"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          handleEditInputChange("proof", event.target.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={styles.hiddenFileInput}
                  />
                  {editFormData.proof && (
                    <button
                      type="button"
                      onClick={() => handleEditInputChange("proof", "")}
                      className={styles.removeImageBtn}
                    >
                      Remove Proof
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.modalFooter}>
            {editingArrayIndex !== null && !isNewItem && (
              <button
                className={styles.deleteBtn}
                onClick={() => {
                  setEditFormData({});
                  saveEdit({ isDelete: true });
                }}
              >
                Delete
              </button>
            )}
            <button
              className={styles.cancelBtn}
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={saveEdit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : isNewItem ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.profileContainer}>
      {/* Main Grid Layout: Sidebar + Content */}
      <div className={styles.mainGrid}>
        {/* Left Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            {/* Profile Card */}
            <div className={styles.profileCard}>
              <div
                className={styles.profileImageWrapper}
                onClick={() => isCurrentUser && openEditField("profilePicture")}
                title={isCurrentUser ? "Click to edit profile picture" : ""}
              >
                <img
                  src={
                    user.profilePicture ||
                    "/placeholder.svg?height=150&width=150"
                  }
                  alt={user.username}
                  className={styles.profileImage}
                />
                {isCurrentUser && (
                  <div className={styles.imageEditOverlay}>
                    <span className={styles.editIcon}>✎</span>
                  </div>
                )}
              </div>

              <h1 className={styles.userName}>{user.username}</h1>
              <p className={styles.userUsername}>@{user.username}</p>

              {user.currentCity && (
                <p className={styles.userCity}>{user.currentCity}</p>
              )}

              {user?.isFreelancer && (
                <div className={styles.verifiedBadge}>✓ Freelancer</div>
              )}

              {isCurrentUser && !user?.isFreelancer && (
                <button
                  onClick={handleBecomeFreelancer}
                  disabled={isSaving || user.isFreelancer}
                  className={styles.becomeFreelancerBtn}
                >
                  {isSaving
                    ? "Processing..."
                    : user.isFreelancer
                    ? "Freelancer"
                    : "Become a Freelancer"}
                </button>
              )}

              {!isCurrentUser && user?.isFreelancer && (
                <button
                  className={styles.giveOrderBtn}
                  onClick={() => setShowOrderModal(true)}
                >
                  Send Order
                </button>
              )}
            </div>

            {/* Quick Stats for Freelancer */}
            {user?.isFreelancer && (
              <div className={styles.quickStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Rating</span>
                  <div className={styles.statValue}>
                    {renderStars(user.averageStars)}
                    <span>{user.averageStars}</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Orders</span>
                  <span className={styles.statValue}>
                    {user.totalOrdersRecieved}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Satisfied</span>
                  <span className={styles.statValue}>
                    {user.customers.satisfiedCustomers}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className={styles.mainContent}>
          {user?.isFreelancer ? (
            // Freelancer Content
            <>
              <section className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Expertise</h2>
                  {isCurrentUser && (
                    <button
                      className={styles.editBtn}
                      onClick={() => openEditField("expertise")}
                    >
                      + Add Skill
                    </button>
                  )}
                </div>
                {user.expertise && user.expertise.length > 0 ? (
                  <div className={styles.tagsContainer}>
                    {user.expertise.map((exp, idx) => (
                      <div key={idx} className={styles.tag}>
                        {exp}
                        {isCurrentUser && (
                          <button
                            className={styles.tagRemove}
                            onClick={() => openEditField("expertise", idx)}
                            title="Edit or remove"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  isCurrentUser && (
                    <p className={styles.emptyFieldText}>
                      Add your expertise and skills to your profile
                    </p>
                  )
                )}
              </section>

              <section className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Available Cities</h2>
                  {isCurrentUser && (
                    <button
                      className={styles.editBtn}
                      onClick={() => openEditField("citiesToWorkIn")}
                    >
                      + Add City
                    </button>
                  )}
                </div>
                {user.citiesToWorkIn && user.citiesToWorkIn.length > 0 ? (
                  <div className={styles.tagsContainer}>
                    {user.citiesToWorkIn.map((city, idx) => (
                      <div key={idx} className={styles.cityTag}>
                        📍 {city}
                        {isCurrentUser && (
                          <button
                            className={styles.tagRemove}
                            onClick={() => openEditField("citiesToWorkIn", idx)}
                            title="Edit or remove"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  isCurrentUser && (
                    <p className={styles.emptyFieldText}>
                      Add cities where you're available to work
                    </p>
                  )
                )}
              </section>

              <section className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Experience</h2>
                  {isCurrentUser && (
                    <button
                      className={styles.editBtn}
                      onClick={() => openEditField("workExperience")}
                    >
                      + Add Experience
                    </button>
                  )}
                </div>
                {user.workExperience && user.workExperience.length > 0 ? (
                  <div className={styles.experienceList}>
                    {user.workExperience.map((exp, idx) => (
                      <div key={idx} className={styles.experienceItem}>
                        <div className={styles.expHeader}>
                          <h3 className={styles.expDesignation}>
                            {exp.designation}
                          </h3>
                          <span className={styles.expSpan}>
                            {exp.experienceSpan}
                          </span>
                        </div>
                        <p className={styles.expOrganization}>
                          {exp.organization}
                        </p>
                        <p className={styles.expDuration}>
                          {exp.experience} years
                        </p>
                        {isCurrentUser && (
                          <button
                            className={styles.itemEditBtn}
                            onClick={() => openEditField("workExperience", idx)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  isCurrentUser && (
                    <p className={styles.emptyFieldText}>
                      Add your work experience to build credibility
                    </p>
                  )
                )}
              </section>

              <section className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Education</h2>
                  {isCurrentUser && (
                    <button
                      className={styles.editBtn}
                      onClick={() => openEditField("degrees")}
                    >
                      + Add Degree
                    </button>
                  )}
                </div>
                {user.degrees && user.degrees.length > 0 ? (
                  <div className={styles.degreeList}>
                    {user.degrees.map((deg, idx) => (
                      <div key={idx} className={styles.degreeItem}>
                        <h3 className={styles.degreeName}>{deg.degree}</h3>
                        <p className={styles.degreeInstitute}>
                          {deg.institute}
                        </p>
                        {isCurrentUser && (
                          <button
                            className={styles.itemEditBtn}
                            onClick={() => openEditField("degrees", idx)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  isCurrentUser && (
                    <p className={styles.emptyFieldText}>
                      Add your educational qualifications
                    </p>
                  )
                )}
              </section>

              {user.reviews && user.reviews.length > 0 && (
                <section className={styles.contentSection}>
                  <h2 className={styles.reviewsTitle}>
                    Reviews ({user.reviews.length})
                  </h2>
                  <div className={styles.reviewsList}>
                    {user.reviews.map((review, idx) => (
                      <div key={idx} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <img
                            src={
                              review.customerInfo.profilePicture ||
                              "/placeholder.svg"
                            }
                            alt={review.customerInfo.username}
                            className={styles.reviewAvatar}
                          />
                          <div className={styles.reviewerInfo}>
                            <Link
                              href={`/${review.customerInfo.username}`}
                              className={styles.reviewerName}
                            >
                              {review.customerInfo.username}
                            </Link>
                            <div className={styles.reviewStars}>
                              {renderStars(review.stars)}
                            </div>
                          </div>
                        </div>
                        <p className={styles.reviewText}>{review.review}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            // Customer Content
            <>
              <div className={styles.tabsSection}>
                <div className={styles.tabsHeader}>
                  <button
                    className={`${styles.tabBtn} ${
                      activeTab === "orders" ? styles.tabBtnActive : ""
                    }`}
                    onClick={() => setActiveTab("orders")}
                  >
                    Order History ({Math.min(user.ordersGiven?.length || 0, 5)})
                  </button>
                  <button
                    className={`${styles.tabBtn} ${
                      activeTab === "reviews" ? styles.tabBtnActive : ""
                    }`}
                    onClick={() => setActiveTab("reviews")}
                  >
                    Reviews ({Math.min(user.reviews?.length || 0, 5)})
                  </button>
                </div>

                {activeTab === "orders" && (
                  <div className={styles.tabContent}>
                    {user.ordersGiven && user.ordersGiven.length > 0 ? (
                      <div className={styles.ordersList}>
                        {user.ordersGiven.slice(0, 5).map((order, idx) => (
                          <div key={idx} className={styles.orderCard}>
                            <div className={styles.orderCardHeader}>
                              <img
                                src={
                                  order.freelancerInfo.profilePicture ||
                                  "/placeholder.svg"
                                }
                                alt={order.freelancerInfo.username}
                                className={styles.freelancerAvatar}
                              />
                              <div className={styles.orderCardInfo}>
                                <Link
                                  href={`/${order.freelancerInfo.username}`}
                                  className={styles.freelancerName}
                                >
                                  {order.freelancerInfo.username}
                                </Link>
                                <p className={styles.serviceDescription}>
                                  {order.problemDescription}
                                </p>
                              </div>
                              <div className={styles.orderCardMeta}>
                                <span className={styles.orderCardDate}>
                                  123
                                </span>
                                <span
                                  className={`${styles.orderCardStatus} ${
                                    styles[order.status]
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </div>
                            </div>
                            {order.review && (
                              <div className={styles.orderCardReview}>
                                <div className={styles.reviewStars}>
                                  {renderStars(order.stars)}
                                </div>
                                <p className={styles.reviewText}>
                                  {order.review}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>No orders yet</p>
                    )}
                  </div>
                )}

                {activeTab === "reviews" && (
                  <div className={styles.tabContent}>
                    {user.reviews && user.reviews.length > 0 ? (
                      <div className={styles.reviewsList}>
                        {user.reviews.slice(0, 5).map((review, idx) => (
                          <div key={idx} className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                              <img
                                src={
                                  review.customerInfo.profilePicture ||
                                  "/placeholder.svg"
                                }
                                alt={review.customerInfo.username}
                                className={styles.reviewAvatar}
                              />
                              <div className={styles.reviewerInfo}>
                                <Link
                                  href={`/${review.customerInfo.username}`}
                                  className={styles.reviewerName}
                                >
                                  {review.customerInfo.username}
                                </Link>
                                <div className={styles.reviewStars}>
                                  {renderStars(review.stars)}
                                </div>
                              </div>
                            </div>
                            <p className={styles.reviewText}>{review.review}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>No reviews yet</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {showEditModal && renderEditModal()}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        freelancerName={user.name}
      />
    </div>
  );
}
