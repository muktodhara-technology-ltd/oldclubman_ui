"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import OldInput from "@/components/custom/OldInput";
import OldSelect from "@/components/custom/OldSelect";
import api from "@/helpers/axios";
import errorResponse from "@/utility";
import { useDispatch, useSelector } from "react-redux";
import { bindProfileData, getMyProfile, storeBsicInformation, saveEducation, saveWork, getUserProfileByUsername } from "../store";
import { FaUser, FaAddressCard, FaIdCard, FaBriefcase } from "react-icons/fa";

const Section = ({ title, icon, children }) => (
  <div className="mb-6 border border-gray-200 rounded-sm overflow-hidden">
    <div className="bg-gray-100 px-4 py-3 flex items-center border-b border-gray-200">
      {icon && <span className="mr-3 text-gray-700">{icon}</span>}
      <h3 className="text-gray-700 font-bold text-sm tracking-wide">{title}</h3>
    </div>
    <div className="bg-white">
      {children}
    </div>
  </div>
);

const FormRow = ({ label, children, isLast }) => (
  <div className={`flex flex-col md:flex-row py-4 px-4 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-200' : ''}`}>
    <div className="w-full md:w-1/3 mb-2 md:mb-0 flex items-center">
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </div>
    <div className="w-full md:w-2/3">
      {children}
    </div>
  </div>
);

const BasicInformation = () => {
  const { profileData, loading, profile } = useSelector(({ settings }) => settings);
  const dispatch = useDispatch();

  // Extract data from profile metas
  const workDataForShow = profile.client?.metas?.filter(dd => dd.meta_key === "WORK") || [];
  const educationDataShow = profile.client?.metas?.filter(dd => dd.meta_key === "EDUCATION") || [];
  const profileCategoriesDataShow = profile.client?.metas?.filter(dd => dd.meta_key === "PROFILE") || [];

  const {
    fname,
    middle_name,
    last_name,
    display_name,
    username,
    email,
    dob,
    gender,
    nationality,
    phone_code,
    contact_no,
    contact_no_code,
    cell_number_code,
    id_no_type,
    id_no,
    address_line_1,
    address_line_2,
    current_country_id,
    current_state_id,
    from_country_id,
    from_state_id,
    from_city_id,
    zip_code,
    marital_status,
    designation,
    blood_group,
    is_blood_donor,
    is_spouse_need,
    relationship_status,
    pronounce_name,
    current_city,
    employment_name,
    language_name,
    website,
    member_of_group,
    cell_number
  } = profileData;

  console.log('profileData from basick form', profileData)

  const [countries, setCountries] = useState([]);
  const [countryCodes, setCountryCodes] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCountryCodes, setLoadingCountryCodes] = useState(false);

  // Fetch user data on component mount
  useEffect(() => {
    dispatch(getMyProfile());
    fetchCountries();
  }, [dispatch]);

  // Fetch profile by username once we have it from state
  useEffect(() => {
    if (profile?.client?.username) {
      dispatch(getUserProfileByUsername(profile.client.username));
    }
  }, [profile?.client?.username, dispatch]);

  const fetchCountries = async () => {
    try {
      const response = await api.get(
        `${process.env.NEXT_PUBLIC_API_URL}/location/country`
      );
      if (response.data && response.data.data) {
        const countryOptions = response.data.data.map((country) => ({
          value: country.id.toString(),
          label: country.name,
        }));
        setCountries(countryOptions);

        // Create country code options with phone codes and sort alphabetically
        const countryCodeOptions = response.data.data
          .filter((country) => country.phonecode) // Filter out countries without phone codes
          .map((country) => ({
            id: country.id, // Unique ID for key
            value: `+${country.phonecode}`,
            label: `${country.name} (+${country.phonecode})`,
            code: `+${country.phonecode}`,
            name: country.name, // Keep name for sorting
          }))
          .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by country name
        setCountryCodes(countryCodeOptions);
      }
    } catch (error) {
      errorResponse(error);
    }
  };

  const handleCountryCodeFocus = async () => {
    // If country codes are already loaded, don't fetch again
    if (countryCodes.length > 0 && !loadingCountryCodes) {
      return;
    }

    setLoadingCountryCodes(true);
    try {
      const response = await api.get(
        `${process.env.NEXT_PUBLIC_API_URL}/location/country`
      );
      if (response.data && response.data.data) {
        // Create country code options with phone codes and sort alphabetically
        const countryCodeOptions = response.data.data
          .filter((country) => country.phonecode) // Filter out countries without phone codes
          .map((country) => ({
            id: country.id, // Unique ID for key
            value: `+${country.phonecode}`,
            label: `${country.name} (+${country.phonecode})`,
            code: `+${country.phonecode}`,
            name: country.name, // Keep name for sorting
          }))
          .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by country name
        setCountryCodes(countryCodeOptions);
      }
    } catch (error) {
      errorResponse(error);
    } finally {
      setLoadingCountryCodes(false);
    }
  };

  const fetchStates = async (countryId, type = "current") => {
    try {
      const response = await api.get(
        `${process.env.NEXT_PUBLIC_API_URL}/location/state?country_id=${countryId}`
      );
      if (response.data && response.data.data) {
        const stateOptions = response.data.data.map((state) => ({
          value: state.id.toString(),
          label: state.name,
        }));
        setStates((prev) => ({
          ...prev,
          [type]: stateOptions,
        }));
      }
    } catch (error) {
      errorResponse(error);
    }
  };

  const fetchCities = async (stateId) => {
    try {
      const response = await api.get(
        `${process.env.NEXT_PUBLIC_API_URL}/location/city?state_id=${stateId}`
      );
      if (response.data && response.data.data) {
        const cityOptions = response.data.data.map((city) => ({
          value: city.id.toString(),
          label: city.name,
        }));
        setCities(cityOptions);
      }
    } catch (error) {
      errorResponse(error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === 'checkbox' ? checked : value;
    dispatch(bindProfileData({ ...profileData, [name]: inputValue }));

    // Handle dependent dropdowns
    if (name === "current_country_id") {
      fetchStates(value, "current");
    } else if (name === "from_country_id") {
      fetchStates(value, "from");
      dispatch(
        bindProfileData({
          ...profileData,
          from_country_id: value,
          from_state_id: "",
          from_city_id: "",
        })
      );
    } else if (name === "from_state_id") {
      fetchCities(value);
      dispatch(
        bindProfileData({
          ...profileData,
          from_city_id: "",
        })
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submittedData = {
      ...profileData,
      metas: JSON.stringify(profileData?.metas),
      profile_visibility: profileData?.profile_visibility
    }

    console.log('submittedData', JSON.stringify(submittedData, null, 2))

    try {
      // Save basic information
      await dispatch(storeBsicInformation(submittedData)).unwrap();
      toast.success("Profile updated successfully");
      dispatch(getMyProfile());
    } catch (error) {
      console.error('Error saving data:', error);
      errorResponse(error);
      toast.error("Failed to save. Please try again.");
    }
  };

  // Work Section Component
  const WorkSection = () => {
    const [isAddingWork, setIsAddingWork] = useState(false);
    const [editingWorkId, setEditingWorkId] = useState(null);
    const [workFormData, setWorkFormData] = useState({
      id: "",
      position: "",
      company: "",
      start_date: "",
      end_date: "",
      description: ""
    });

    const handleAddWork = () => {
      const workId = `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setIsAddingWork(true);
      setWorkFormData({
        id: workId,
        position: "",
        company: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleEditWork = (work) => {
      setEditingWorkId(work.id);
      setWorkFormData({
        id: work.id,
        position: work.position || "",
        company: work.company || "",
        start_date: work.start_date || "",
        end_date: work.end_date || "",
        description: work.description || ""
      });
    };

    const handleSaveWork = () => {
      const workId = editingWorkId || `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newWork = {
        id: workId,
        ...workFormData,
        status: 'public'
      };

      // Get current work entries from profile
      let currentWorkEntries = [];
      if (workDataForShow && workDataForShow.length > 0) {
        try {
          currentWorkEntries = typeof workDataForShow[0].meta_value === 'string'
            ? JSON.parse(workDataForShow[0].meta_value)
            : workDataForShow[0].meta_value || [];
        } catch (error) {
          console.error('Error parsing current work data:', error);
          currentWorkEntries = [];
        }
      }

      let updatedWorkEntries;
      if (editingWorkId) {
        updatedWorkEntries = currentWorkEntries.map(work =>
          work.id === editingWorkId ? newWork : work
        );
      } else {
        updatedWorkEntries = [...currentWorkEntries, newWork];
      }

      // Save to backend using metas structure
      const metas = [
        {
          meta_key: 'WORK',
          meta_value: JSON.stringify(updatedWorkEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      // Also save to work table
      const submittedData = {
        company_name: workFormData?.company,
        position: workFormData?.position,
        start_date: workFormData?.start_date,
        end_date: workFormData?.end_date,
        description: workFormData?.description,
        status: 1,
      };

      dispatch(saveWork(submittedData));
      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Work added successfully");
        });

      // Reset form
      setIsAddingWork(false);
      setEditingWorkId(null);
      setWorkFormData({
        id: "",
        position: "",
        company: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleCancelWork = () => {
      setIsAddingWork(false);
      setEditingWorkId(null);
      setWorkFormData({
        id: "",
        position: "",
        company: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleWorkFormChange = (e) => {
      const { name, value } = e.target;
      setWorkFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleDeleteWork = (data, id) => {
      const updatedWorkEntries = data?.filter(work => work.id !== id);

      const metas = [
        {
          meta_key: 'WORK',
          meta_value: JSON.stringify(updatedWorkEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Work entry deleted");
        });
    };

    return (
      <div className="w-full">

        {/* Display work entries */}
        {workDataForShow && workDataForShow.length > 0 && workDataForShow.map((workData, index) => {
          const workEntries = typeof workData.meta_value === 'string'
            ? JSON.parse(workData.meta_value)
            : workData.meta_value || [];

          return Array.isArray(workEntries) ? workEntries.map((entry, entryIndex) => {
            const uniqueId = entry.id || `work_${index}_${entryIndex}_${Date.now()}`;

            return (
              <div key={uniqueId} className="flex items-center mb-3 last:mb-0 p-3 bg-gray-50 rounded-md">
                <div className="flex-1 text-sm text-gray-700">
                  <div className="font-medium">{entry.position}</div>
                  <div className="text-gray-500">{entry.company}</div>
                  {(entry.start_date || entry.end_date) && (
                    <div className="text-xs text-gray-400">
                      {entry.start_date} - {entry.end_date || 'Present'}
                    </div>
                  )}
                </div>

                <button
                  className="text-gray-400 ml-2 hover:text-gray-600"
                  onClick={() => handleEditWork({ ...entry, id: entry.id || uniqueId })}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>

                <button
                  className="text-red-400 ml-2 hover:text-red-600"
                  onClick={() => handleDeleteWork(workEntries, entry.id || uniqueId)}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            );
          }) : null;
        })}

        {(!workDataForShow || workDataForShow.length === 0 ||
          (workDataForShow[0] && (!workDataForShow[0].meta_value || JSON.parse(workDataForShow[0].meta_value || '[]').length === 0))) && (
            <div className="text-gray-500 text-sm py-2">No work experience added yet</div>
          )}

        {/* Add/Edit Work Form */}
        {(isAddingWork || editingWorkId) && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 mt-4">
            <h5 className="font-semibold mb-3">
              {editingWorkId ? 'Edit Work' : 'Add Work'}
            </h5>
            <div className="space-y-3">
              <input
                type="text"
                name="position"
                placeholder="Position"
                value={workFormData.position}
                onChange={handleWorkFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                name="company"
                placeholder="Company"
                value={workFormData.company}
                onChange={handleWorkFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  name="start_date"
                  placeholder="Start Date"
                  value={workFormData.start_date}
                  onChange={handleWorkFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  name="end_date"
                  placeholder="End Date"
                  value={workFormData.end_date}
                  onChange={handleWorkFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <textarea
                name="description"
                placeholder="Description"
                value={workFormData.description}
                onChange={handleWorkFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWork}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelWork}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Work Button */}
        {!isAddingWork && !editingWorkId && (
          <button
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors mt-4"
            onClick={handleAddWork}
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium">Add a workplace</span>
          </button>
        )}
      </div>
    );
  };

  // Education Section Component
  const EducationSection = () => {
    const [isAddingEducation, setIsAddingEducation] = useState(false);
    const [editingEducationId, setEditingEducationId] = useState(null);
    const [educationFormData, setEducationFormData] = useState({
      id: "",
      institution: "",
      degree: "",
      field_of_study: "",
      start_date: "",
      end_date: "",
      description: ""
    });

    const handleAddEducation = () => {
      const educationId = `education_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setIsAddingEducation(true);
      setEducationFormData({
        id: educationId,
        institution: "",
        degree: "",
        field_of_study: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleEditEducation = (education) => {
      setEditingEducationId(education.id);
      setEducationFormData({
        id: education.id,
        institution: education.institution || "",
        degree: education.degree || "",
        field_of_study: education.field_of_study || "",
        start_date: education.start_date || "",
        end_date: education.end_date || "",
        description: education.description || ""
      });
    };

    const handleSaveEducation = () => {
      const educationId = editingEducationId || `education_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newEducation = {
        id: educationId,
        ...educationFormData,
        status: 'public'
      };

      // Get current education entries from profile
      let currentEducationEntries = [];
      if (educationDataShow && educationDataShow.length > 0) {
        try {
          currentEducationEntries = typeof educationDataShow[0].meta_value === 'string'
            ? JSON.parse(educationDataShow[0].meta_value)
            : educationDataShow[0].meta_value || [];
        } catch (error) {
          console.error('Error parsing current education data:', error);
          currentEducationEntries = [];
        }
      }

      let updatedEducationEntries;
      if (editingEducationId) {
        updatedEducationEntries = currentEducationEntries.map(education =>
          education.id === editingEducationId ? newEducation : education
        );
      } else {
        updatedEducationEntries = [...currentEducationEntries, newEducation];
      }

      // Save to backend using metas structure
      const metas = [
        {
          meta_key: 'EDUCATION',
          meta_value: JSON.stringify(updatedEducationEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      // Also save to education table
      const submittedData = {
        institution: educationFormData?.institution,
        field_of_study: educationFormData?.field_of_study,
        degree: educationFormData?.degree,
        start_date: educationFormData?.start_date,
        end_date: educationFormData?.end_date,
        description: educationFormData?.description,
        status: 1,
      };

      dispatch(saveEducation(submittedData));
      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Education added successfully");
        });

      // Reset form
      setIsAddingEducation(false);
      setEditingEducationId(null);
      setEducationFormData({
        id: "",
        institution: "",
        degree: "",
        field_of_study: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleCancelEducation = () => {
      setIsAddingEducation(false);
      setEditingEducationId(null);
      setEducationFormData({
        id: "",
        institution: "",
        degree: "",
        field_of_study: "",
        start_date: "",
        end_date: "",
        description: ""
      });
    };

    const handleEducationFormChange = (e) => {
      const { name, value } = e.target;
      setEducationFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleDeleteEducation = (data, id) => {
      const updatedEducationEntries = data?.filter(education => education.id !== id);

      const metas = [
        {
          meta_key: 'EDUCATION',
          meta_value: JSON.stringify(updatedEducationEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Education entry deleted");
        });
    };

    return (
      <div className="w-full">

        {/* Display education entries */}
        {educationDataShow && educationDataShow.length > 0 && educationDataShow.map((educationData, index) => {
          let educationEntries = [];

          try {
            if (typeof educationData.meta_value === 'string') {
              educationEntries = JSON.parse(educationData.meta_value);
            } else if (Array.isArray(educationData.meta_value)) {
              educationEntries = educationData.meta_value;
            } else if (educationData.meta_value) {
              educationEntries = [educationData.meta_value];
            }
          } catch (error) {
            console.error('Error parsing education data:', error);
            educationEntries = [];
          }

          return Array.isArray(educationEntries) ? educationEntries.map((entry, entryIndex) => {
            const uniqueId = entry.id || `education_${index}_${entryIndex}_${Date.now()}`;

            return (
              <div key={uniqueId} className="flex items-center mb-3 last:mb-0 p-3 bg-gray-50 rounded-md">
                <div className="flex-1 text-sm text-gray-700">
                  <div className="font-medium">{entry.degree}</div>
                  <div className="text-gray-500">{entry.institution}</div>
                  {entry.field_of_study && (
                    <div className="text-xs text-gray-400">{entry.field_of_study}</div>
                  )}
                  {(entry.start_date || entry.end_date) && (
                    <div className="text-xs text-gray-400">
                      {entry.start_date} - {entry.end_date || 'Present'}
                    </div>
                  )}
                </div>

                <button
                  className="text-gray-400 ml-2 hover:text-gray-600"
                  onClick={() => handleEditEducation({ ...entry, id: entry.id || uniqueId })}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>

                <button
                  className="text-red-400 ml-2 hover:text-red-600"
                  onClick={() => handleDeleteEducation(educationEntries, entry.id || uniqueId)}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            );
          }) : null;
        })}

        {(!educationDataShow || educationDataShow.length === 0 ||
          (educationDataShow[0] && (!educationDataShow[0].meta_value || JSON.parse(educationDataShow[0].meta_value || '[]').length === 0))) && (
            <div className="text-gray-500 text-sm py-2">No education added yet</div>
          )}

        {/* Add/Edit Education Form */}
        {(isAddingEducation || editingEducationId) && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 mt-4">
            <h5 className="font-semibold mb-3">
              {editingEducationId ? 'Edit Education' : 'Add Education'}
            </h5>
            <div className="space-y-3">
              <input
                type="text"
                name="institution"
                placeholder="Institution"
                value={educationFormData.institution}
                onChange={handleEducationFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                name="degree"
                placeholder="Degree"
                value={educationFormData.degree}
                onChange={handleEducationFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                name="field_of_study"
                placeholder="Field of Study"
                value={educationFormData.field_of_study}
                onChange={handleEducationFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  name="start_date"
                  placeholder="Start Date"
                  value={educationFormData.start_date}
                  onChange={handleEducationFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  name="end_date"
                  placeholder="End Date"
                  value={educationFormData.end_date}
                  onChange={handleEducationFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <textarea
                name="description"
                placeholder="Description"
                value={educationFormData.description}
                onChange={handleEducationFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEducation}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEducation}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Education Button */}
        {!isAddingEducation && !editingEducationId && (
          <button
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors mt-4"
            onClick={handleAddEducation}
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium">Add education</span>
          </button>
        )}
      </div>
    );
  };

  // Profile Categories Section Component
  const ProfileCategoriesSection = () => {
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [categoryInput, setCategoryInput] = useState("");
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const defaultCategories = [
      "Actor / Director",
      "Artist",
      "Athlete",
      "Author",
      "Band",
      "Blogger",
      "Chef",
      "Comedian",
      "Dancer",
      "Designer",
      "Digital Creator",
      "Editor",
      "Entrepreneur / Business Person",
      "Fashion Designer / Model",
      "Film Director",
      "Fitness Model",
      "Gamer / Gaming Video Creator",
      "Journalist",
      "Motivational Speaker",
      "Musician / Band",
      "News Personality",
      "Photographer",
      "Producer",
      "Scientist / Spiritual Leader",
      "Sports Promoter / Sportsperson / Coach",
      "Teacher",
      "Video Creator",
      "Writer / Author",
      "Politician / Government Official / Political Candidate",
      "Entertainer",
      "Public Figure"
    ];

    const handleAddCategory = () => {
      setIsFormVisible(true);
      setCategoryInput("");
      setSelectedCategories([]);
      setEditingCategoryId(null);
    };

    const handleSelectSuggestion = (category) => {
      if (!category) return;
      if (editingCategoryId) {
        setSelectedCategories([category]);
      } else {
        setSelectedCategories((prev) => prev.includes(category) ? prev : [...prev, category]);
      }
      setCategoryInput("");
      setShowSuggestions(false);
    };

    const handleAddCategoryFromInput = () => {
      const trimmed = categoryInput.trim();
      if (!trimmed) return;
      const exactDefault = defaultCategories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
      const toAdd = exactDefault || trimmed;
      if (editingCategoryId) {
        setSelectedCategories([toAdd]);
      } else {
        setSelectedCategories((prev) => prev.includes(toAdd) ? prev : [...prev, toAdd]);
      }
      setCategoryInput("");
      setShowSuggestions(false);
    };

    const handleRemoveSelectedCategory = (category) => {
      setSelectedCategories((prev) => prev.filter((c) => c !== category));
    };

    const handleEditCategory = (categoryEntry) => {
      setEditingCategoryId(categoryEntry.id);
      setIsFormVisible(true);
      setCategoryInput("");
      setSelectedCategories([categoryEntry.category || ""]);
    };

    const handleSaveCategories = () => {
      const categoryId = editingCategoryId || `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get current profile entries from profile
      let currentProfileEntries = [];
      if (profileCategoriesDataShow && profileCategoriesDataShow.length > 0) {
        try {
          currentProfileEntries = typeof profileCategoriesDataShow[0].meta_value === 'string'
            ? JSON.parse(profileCategoriesDataShow[0].meta_value)
            : profileCategoriesDataShow[0].meta_value || [];
        } catch (error) {
          console.error('Error parsing current profile data:', error);
          currentProfileEntries = [];
        }
      }

      let updatedProfileEntries;
      if (editingCategoryId) {
        // Update existing category
        const newCategory = {
          id: categoryId,
          category: selectedCategories[0] || "",
          status: 'public'
        };
        updatedProfileEntries = currentProfileEntries.map(profile =>
          profile.id === editingCategoryId ? newCategory : profile
        );
      } else {
        // Add multiple categories as separate entries
        const entriesToAdd = selectedCategories.map((cat) => ({
          id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: cat,
          status: 'public'
        }));
        updatedProfileEntries = [...currentProfileEntries, ...entriesToAdd];
      }

      // Save to backend using metas structure
      const metas = [
        {
          meta_key: 'PROFILE',
          meta_value: JSON.stringify(updatedProfileEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Categories updated");
        });

      // Reset form
      setIsFormVisible(false);
      setEditingCategoryId(null);
      setSelectedCategories([]);
      setCategoryInput("");
    };

    const handleCancelCategories = () => {
      setIsFormVisible(false);
      setEditingCategoryId(null);
      setSelectedCategories([]);
      setCategoryInput("");
    };

    const handleCategoryInputChange = (e) => {
      setCategoryInput(e.target.value);
      setShowSuggestions(true);
    };

    const handleCategoryInputKeyPress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = categoryInput.trim();
        if (!trimmed) return;
        const firstMatch = defaultCategories.find((c) => c.toLowerCase() === trimmed.toLowerCase())
          || defaultCategories.find((c) => c.toLowerCase().includes(trimmed.toLowerCase()));
        if (firstMatch) {
          handleSelectSuggestion(firstMatch);
        } else {
          handleAddCategoryFromInput();
        }
      }
    };

    const handleDeleteCategory = (data, id) => {
      const updatedProfileEntries = data?.filter(profile => profile.id !== id);

      const metas = [
        {
          meta_key: 'PROFILE',
          meta_value: JSON.stringify(updatedProfileEntries),
          meta_status: '1'
        }
      ];

      const saveData = {
        ...profileData,
        metas: JSON.stringify(metas).replace(/"/g, "'"),
        profile_visibility: profileData?.profile_visibility
      };

      dispatch(storeBsicInformation(saveData))
        .then(() => {
          dispatch(getMyProfile());
          toast.success("Category deleted");
        });
    };

    return (
      <div className="w-full">

        {/* Display existing profile entries */}
        {profileCategoriesDataShow && profileCategoriesDataShow.length > 0 && profileCategoriesDataShow.map((profileData, index) => {
          const profileEntries = typeof profileData.meta_value === 'string'
            ? JSON.parse(profileData.meta_value)
            : profileData.meta_value || [];

          return Array.isArray(profileEntries) ? profileEntries.map((entry, entryIndex) => {
            const uniqueId = entry.id || `profile_${index}_${entryIndex}_${Date.now()}`;

            return (
              <div key={uniqueId} className="mb-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="text-gray-900 font-medium">{entry.category || 'Category'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        onClick={() => handleEditCategory({ ...entry, id: entry.id || uniqueId })}
                        title="Edit category"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                        onClick={() => handleDeleteCategory(profileEntries, entry.id || uniqueId)}
                        title="Delete category"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : null;
        })}

        {(!profileCategoriesDataShow || profileCategoriesDataShow.length === 0 ||
          (profileCategoriesDataShow[0] && (!profileCategoriesDataShow[0].meta_value || JSON.parse(profileCategoriesDataShow[0].meta_value || '[]').length === 0))) && (
            <div className="text-gray-500 text-sm py-2">No categories added yet</div>
          )}

        {/* Add New Category Form */}
        {isFormVisible && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Categories</span>
            </div>

            {/* Category Input Field with Multi-select and Suggestions */}
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex flex-wrap gap-2 items-center">
                {selectedCategories.map((cat) => (
                  <div key={cat} className="inline-flex items-center bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                    <span>{cat}</span>
                    <button
                      onClick={() => handleRemoveSelectedCategory(cat)}
                      className="ml-2 text-white hover:text-gray-200"
                      type="button"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    type="text"
                    placeholder={editingCategoryId ? "Choose a category" : "Type to search categories"}
                    value={categoryInput}
                    onChange={handleCategoryInputChange}
                    onKeyPress={handleCategoryInputKeyPress}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full outline-none text-sm"
                  />
                  {showSuggestions && categoryInput.trim().length > 0 && (
                    <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-sm">
                      {defaultCategories
                        .filter((c) => c.toLowerCase().includes(categoryInput.toLowerCase()))
                        .filter((c) => !selectedCategories.includes(c))
                        .slice(0, 20)
                        .map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleSelectSuggestion(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                          >
                            {c}
                          </button>
                        ))}
                      {defaultCategories.filter((c) => c.toLowerCase().includes(categoryInput.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <hr className="my-3 border-gray-200" />

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={handleCancelCategories}
                className="px-3 py-1 rounded-full text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategories}
                className={`px-3 py-1 rounded-full text-sm ${(editingCategoryId ? selectedCategories.length === 1 : selectedCategories.length > 0)
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                disabled={!(editingCategoryId ? selectedCategories.length === 1 : selectedCategories.length > 0)}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Add Category Button */}
        {!isFormVisible && (
          <button
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors mt-4"
            onClick={handleAddCategory}
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium">Add category</span>
          </button>
        )}
      </div>
    );
  };

  // ID type options
  const idTypeOptions = [
    { value: "passport", label: "Passport" },
    { value: "national_id", label: "National ID" },
    { value: "driving_license", label: "Driving License" },
  ];

  // Marital status options
  const maritalStatusOptions = [
    { value: 1, label: "Single" },
    { value: 2, label: "Married" },
    { value: 3, label: "Divorced" },
    { value: 4, label: "Widowed" },
  ];

  const bloodGroupOptions = [
    {
      label: "A+",
      value: "A+",
      "abo_group": "A",
      "rh_factor": "Positive",
      "antigens": ["A", "Rh"],
      "antibodies": ["Anti-B"],
      "description": "Has A and Rh antigens on red cells, with Anti-B antibodies in plasma."
    },
    {
      label: "A-",
      value: "A-",
      "abo_group": "A",
      "rh_factor": "Negative",
      "antigens": ["A"],
      "antibodies": ["Anti-B", "Anti-Rh"],
      "description": "Has A antigens on red cells, with Anti-B and Anti-Rh antibodies in plasma."
    },
    {
      label: "B+",
      value: "B+",
      "abo_group": "B",
      "rh_factor": "Positive",
      "antigens": ["B", "Rh"],
      "antibodies": ["Anti-A"],
      "description": "Has B and Rh antigens on red cells, with Anti-A antibodies in plasma."
    },
    {
      label: "B-",
      value: "B-",
      "abo_group": "B",
      "rh_factor": "Negative",
      "antigens": ["B"],
      "antibodies": ["Anti-A", "Anti-Rh"],
      "description": "Has B antigens on red cells, with Anti-A and Anti-Rh antibodies in plasma."
    },
    {
      label: "AB+",
      value: "AB+",
      "abo_group": "AB",
      "rh_factor": "Positive",
      "antigens": ["A", "B", "Rh"],
      "antibodies": [],
      "description": "Has A, B, and Rh antigens on red cells, with no A or B antibodies in plasma (universal recipient)."
    },
    {
      label: "AB-",
      value: "AB-",
      "abo_group": "AB",
      "rh_factor": "Negative",
      "antigens": ["A", "B"],
      "antibodies": ["Anti-Rh"],
      "description": "Has A and B antigens on red cells, with Anti-Rh antibodies in plasma."
    },
    {
      label: "O+",
      value: "O+",
      "abo_group": "O",
      "rh_factor": "Positive",
      "antigens": ["Rh"],
      "antibodies": ["Anti-A", "Anti-B"],
      "description": "Has Rh antigens on red cells, with Anti-A and Anti-B antibodies in plasma."
    },
    {
      label: "O-",
      value: "O-",
      "abo_group": "O",
      "rh_factor": "Negative",
      "antigens": [],
      "antibodies": ["Anti-A", "Anti-B", "Anti-Rh"],
      "description": "Has no A, B, or Rh antigens on red cells, with Anti-A, Anti-B, and Anti-Rh antibodies in plasma (universal donor)."
    }
  ];

  // Languages options for Languages field
  const languageOptions = [
    { value: "English", label: "English" },
    { value: "Bengali", label: "Bengali" },
    { value: "Hindi", label: "Hindi" },
    { value: "Spanish", label: "Spanish" },
    { value: "Arabic", label: "Arabic" },
    { value: "French", label: "French" },
    { value: "German", label: "German" },
    { value: "Chinese", label: "Chinese" },
    { value: "Japanese", label: "Japanese" },
    { value: "Korean", label: "Korean" },
    { value: "Portuguese", label: "Portuguese" },
    { value: "Russian", label: "Russian" },
    { value: "Urdu", label: "Urdu" },
    { value: "Turkish", label: "Turkish" },
    { value: "Italian", label: "Italian" },
    { value: "Dutch", label: "Dutch" },
    { value: "Indonesian", label: "Indonesian" },
    { value: "Thai", label: "Thai" },
    { value: "Vietnamese", label: "Vietnamese" },
    { value: "Persian", label: "Persian" }
  ];

  // Profession options for Employment field
  const professionOptions = [
    { value: "software_engineer", label: "Software Engineer" },
    { value: "web_developer", label: "Web Developer" },
    { value: "mobile_developer", label: "Mobile App Developer" },
    { value: "data_scientist", label: "Data Scientist" },
    { value: "product_manager", label: "Product Manager" },
    { value: "project_manager", label: "Project Manager" },
    { value: "ui_ux_designer", label: "UI/UX Designer" },
    { value: "graphic_designer", label: "Graphic Designer" },
    { value: "system_admin", label: "System Administrator" },
    { value: "devops_engineer", label: "DevOps Engineer" },
    { value: "qa_engineer", label: "QA/Test Engineer" },
    { value: "network_engineer", label: "Network Engineer" },
    { value: "doctor", label: "Doctor" },
    { value: "nurse", label: "Nurse" },
    { value: "pharmacist", label: "Pharmacist" },
    { value: "dentist", label: "Dentist" },
    { value: "surgeon", label: "Surgeon" },
    { value: "psychologist", label: "Psychologist" },
    { value: "teacher", label: "Teacher" },
    { value: "professor", label: "Professor" },
    { value: "architect", label: "Architect" },
    { value: "civil_engineer", label: "Civil Engineer" },
    { value: "mechanical_engineer", label: "Mechanical Engineer" },
    { value: "electrical_engineer", label: "Electrical Engineer" },
    { value: "banker", label: "Banker" },
    { value: "financial_analyst", label: "Financial Analyst" },
    { value: "accountant", label: "Accountant" },
    { value: "lawyer", label: "Lawyer" },
    { value: "hr_specialist", label: "HR Specialist" },
    { value: "sales_representative", label: "Sales Representative" },
    { value: "marketing_manager", label: "Marketing Manager" },
    { value: "business_analyst", label: "Business Analyst" },
    { value: "entrepreneur", label: "Entrepreneur" },
    { value: "consultant", label: "Consultant" },
    { value: "journalist", label: "Journalist" },
    { value: "writer", label: "Writer" },
    { value: "editor", label: "Editor" },
    { value: "photographer", label: "Photographer" },
    { value: "videographer", label: "Videographer" },
    { value: "pilot", label: "Pilot" },
    { value: "flight_attendant", label: "Flight Attendant" },
    { value: "chef", label: "Chef" },
    { value: "cook", label: "Cook" },
    { value: "driver", label: "Driver" },
    { value: "police_officer", label: "Police Officer" },
    { value: "firefighter", label: "Firefighter" },
    { value: "social_worker", label: "Social Worker" },
    { value: "scientist", label: "Scientist" },
    { value: "researcher", label: "Researcher" },
    { value: "farmer", label: "Farmer" },
    { value: "student", label: "Student" },
    { value: "retired", label: "Retired" },
    { value: "unemployed", label: "Unemployed" },
    { value: "other", label: "Other" }
  ];

  console.log('nationality', nationality)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-gray-200 pb-4">
        <h2 className="text-2xl text-gray-700 mb-1">PROFILE</h2>
        <p className="text-sm text-gray-500">Manage all your settings, preferences and features in one easy place.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Section title="Basic Information" icon={<FaUser />}>
          <FormRow label="First Name">
            <OldInput type="text" name="fname" value={fname} onChange={handleInputChange} placeholder="First name" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Middle Name">
            <OldInput type="text" name="middle_name" value={middle_name} onChange={handleInputChange} placeholder="Middle name" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Last Name">
            <OldInput type="text" name="last_name" value={last_name} onChange={handleInputChange} placeholder="Last name" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Display Name">
            <OldInput type="text" name="display_name" value={display_name} onChange={handleInputChange} placeholder="Display name" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="User Name">
            <OldInput type="text" name="username" value={username} onChange={handleInputChange} placeholder="Username" className="w-full max-w-md" />
            <p className="text-xs text-gray-400 mt-1">Link: oldclubman.com/{username}</p>
          </FormRow>
          <FormRow label="Pronounces Name">
            <OldInput type="text" name="pronounce_name" value={pronounce_name} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Date of Birth">
            <OldInput type="date" name="dob" value={dob} onChange={handleInputChange} placeholder="YYYY-MM-DD" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Sex">
            <OldSelect name="gender" value={gender} onChange={handleInputChange} options={[{ value: 0, label: "Male" }, { value: 1, label: "Female" }, { value: 2, label: "Other" }]} placeholder="Select Gender" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Nationality">
            <OldSelect name="nationality" value={profileData?.nationality || ""} onChange={handleInputChange} options={countries} placeholder="Select Nationality" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Relationship Status">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <OldSelect name="marital_status" value={profileData?.marital_status || ""} onChange={handleInputChange} options={maritalStatusOptions} placeholder="Select Marital Status" className="w-full max-w-xs" />
              <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
                <span className="text-xs text-gray-600 mr-3">Looking for partner?</span>
                <button type="button" onClick={() => dispatch(bindProfileData({ ...profileData, is_spouse_need: !profileData?.is_spouse_need }))} role="switch" aria-checked={profileData?.is_spouse_need ? 'true' : 'false'} className={`relative inline-flex h-5 w-9 items-center rounded-full ${profileData?.is_spouse_need ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${profileData?.is_spouse_need ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </FormRow>
          <FormRow label="Blood Group" isLast>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <OldSelect name="blood_group" value={profileData?.blood_group || ""} onChange={handleInputChange} options={bloodGroupOptions} placeholder="Select Blood Group" className="w-full max-w-xs" />
              <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
                <span className="text-xs text-gray-600 mr-3">Blood donor?</span>
                <button type="button" onClick={() => dispatch(bindProfileData({ ...profileData, is_blood_donor: !profileData?.is_blood_donor }))} role="switch" aria-checked={profileData?.is_blood_donor ? 'true' : 'false'} className={`relative inline-flex h-5 w-9 items-center rounded-full ${profileData?.is_blood_donor ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${profileData?.is_blood_donor ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </FormRow>
        </Section>

        <Section title="Contact & Location Information" icon={<FaAddressCard />}>
          <FormRow label="Email Address">
            <OldInput type="email" name="email" value={email} onChange={handleInputChange} placeholder="Email address" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Phone Number">
            <div className="flex gap-2 max-w-md">
              <div className="w-1/3">
                <select name="contact_no_code" value={profileData?.contact_no_code || ""} onChange={handleInputChange} onFocus={handleCountryCodeFocus} onClick={handleCountryCodeFocus} className="w-full border border-slate-200 rounded-md px-[1rem] py-[0.3rem] focus:border-[#155DFC] focus:outline-none">
                  <option value="">{loadingCountryCodes ? "Loading..." : "Code"}</option>
                  {countryCodes.map((country) => <option key={country.id} value={country.value}>{country.value}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <input type="text" name="contact_no" value={profileData?.contact_no || ""} onChange={handleInputChange} placeholder="1234567890" className="w-full border border-slate-200 rounded-md px-[1rem] py-[0.3rem] focus:border-[#155DFC] focus:outline-none" />
              </div>
            </div>
          </FormRow>
          <FormRow label="Cell Number">
            <div className="flex gap-2 max-w-md">
              <div className="w-1/3">
                <select name="cell_number_code" value={profileData?.cell_number_code || ""} onChange={handleInputChange} onFocus={handleCountryCodeFocus} onClick={handleCountryCodeFocus} className="w-full border border-slate-200 rounded-md px-[1rem] py-[0.3rem] focus:border-[#155DFC] focus:outline-none">
                  <option value="">{loadingCountryCodes ? "Loading..." : "Code"}</option>
                  {countryCodes.map((country) => <option key={country.id} value={country.value}>{country.value}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <input type="text" name="cell_number" value={profileData?.cell_number || ""} onChange={handleInputChange} placeholder="1234567890" className="w-full border border-slate-200 rounded-md px-[1rem] py-[0.3rem] focus:border-[#155DFC] focus:outline-none" />
              </div>
            </div>
          </FormRow>
          <FormRow label="Current City">
            <OldInput type="text" name="current_city" value={profileData?.current_city || ""} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
          <FormRow label="State / Province">
            <OldInput type="text" name="current_state" value={profileData?.current_state || ""} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Country of Residence">
            <OldSelect name="current_country_id" value={profileData?.current_country_id || ""} onChange={handleInputChange} options={countries} placeholder="Select Country" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Address Line 1">
            <OldInput type="text" name="address_line_1" value={address_line_1} onChange={handleInputChange} placeholder="Address Line 1" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Address Line 2">
            <OldInput type="text" name="address_line_2" value={address_line_2} onChange={handleInputChange} placeholder="Address Line 2" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Zip Code" isLast>
            <OldInput type="text" name="zip_code" value={zip_code} onChange={handleInputChange} placeholder="Zip Code" className="w-full max-w-md" />
          </FormRow>
        </Section>

        <Section title="Identity Information" icon={<FaIdCard />}>
          <FormRow label="Identity Type">
            <OldSelect name="id_no_type" value={id_no_type} onChange={handleInputChange} options={idTypeOptions} placeholder="Select ID Type" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Issuing Authority">
            <OldSelect name="issuing_authority_country_id" value={profileData?.issuing_authority_country_id || ""} onChange={handleInputChange} options={countries} placeholder="Select Country" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="ID Number" isLast>
            <OldInput type="text" name="id_no" value={id_no} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
        </Section>

        <Section title="Professional & Other Details" icon={<FaBriefcase />}>
          <FormRow label="Employment Field">
            <OldSelect name="employment_name" value={profileData?.employment_name || ""} onChange={handleInputChange} options={professionOptions} placeholder="Select Profession" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Languages Spoken">
            <OldSelect name="language_name" value={profileData?.language_name || ""} onChange={handleInputChange} options={languageOptions} placeholder="Select Language" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Places Lived">
            <OldSelect name="from_country_id" value={profileData?.from_country_id || ""} onChange={handleInputChange} options={countries} placeholder="Select Country" className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Website">
            <OldInput type="text" name="website" value={website} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Member (Particular Group)">
            <OldInput type="text" name="member_of_group" value={member_of_group} onChange={handleInputChange} className="w-full max-w-md" />
          </FormRow>
          <FormRow label="Work Experience">
            <div className="-mx-4 -my-4 sm:-mx-0 sm:-my-0">
              <WorkSection />
            </div>
          </FormRow>
          <FormRow label="Education">
            <div className="-mx-4 -my-4 sm:-mx-0 sm:-my-0">
              <EducationSection />
            </div>
          </FormRow>
          <FormRow label="Profile Categories" isLast>
            <div className="-mx-4 -my-4 sm:-mx-0 sm:-my-0">
              <ProfileCategoriesSection />
            </div>
          </FormRow>
        </Section>

        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center sm:items-center gap-4 bg-gray-50 border border-gray-200 p-4 rounded-b-sm">
          <p className="text-sm text-gray-500 text-center sm:text-left">
            This will save your profile information. Work, Education, and Categories are saved immediately.
          </p>
          <button type="submit" className="bg-gray-800 cursor-pointer text-white px-8 py-2.5 rounded-sm hover:bg-gray-900 transition font-medium min-w-[200px]" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BasicInformation;
