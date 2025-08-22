import React, { useState } from "react";
import AuthLayout from "../../components/layouts/AuthLayout";
import { Link, useNavigate } from "react-router-dom";
import Input from "../../components/Inputs/Input";
import { validateEmail } from "../../utils/helper";
import ProfilePhotoSelector from "../../components/Inputs/ProfilePhotoSelector";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/userContext";
import uploadImage from "../../utils/uploadImage";
import { useContext } from "react";

const SignUp = () => {
  const [profilePic, setProfilePic] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState(null);

  const {updateUser} = useContext(UserContext)

  const navigate = useNavigate();

  //Handle login form submission
  const handleSignUp = async (e) => {
    e.preventDefault();

    let profileImageUrl = "";

    if (!firstName) {
      setError("Please enter your first name.");
      return;
    }

    if (!lastName) {
      setError("Please enter your last name.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    // Sign up API call
    try {

      // Upload image if needed
      if (profilePic) {
        const imgUploadRes = await uploadImage(profilePic);
        profileImageUrl = imgUploadRes.imageUrl || "";
      }

      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
        firstName,
        lastName,
        email,
        phone,
        password,
        profileImageUrl
      });

      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        updateUser(user);
        navigate("/dashboard");
      }
    } catch (error) {
      if (error.response && error.response.data.message) {
        setError(error.response.data.message);
      } else {
        setError("An error occurred while signing up.");
      }
    }
  };

  return (
    <AuthLayout>
      <div className="lg:w-[100%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
        <h3 className="text-xl font-semibold text-black">Create an Account</h3>
        <p className="text-xs text-slate-700 mt-[5px] mb-6">
          Join us and start tracking your expenses and income with ease.
        </p>

        <form onSubmit={handleSignUp}>

          <ProfilePhotoSelector image={profilePic} setImage={setProfilePic} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={firstName}
              onChange={({ target }) => setFirstName(target.value)}
              label="First Name"
              placeholder="John"
              type="text"
            />

            <Input
              value={lastName}
              onChange={({ target }) => setLastName(target.value)}
              label="Last Name"
              placeholder="Doe"
              type="text"
            />
            <Input
              value={email}
              onChange={({ target }) => setEmail(target.value)}
              label="Email Address"
              placeholder="john@example.com"
              type="text"
            />

            <Input
              value={phone}
              onChange={({ target }) => setPhone(target.value)}
              label="Phone Number"
              placeholder="+1234567890"
              type="number"
            />

            <Input
              value={password}
              onChange={({ target }) => setPassword(target.value)}
              label="Enter Password"
              placeholder="********"
              type="password"
            />

            <Input
              value={confirmPassword}
              onChange={({ target }) => setConfirmPassword(target.value)}
              label="Confirm Password"
              placeholder="********"
              type="password"
            />

          </div>

          {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}

          <button type="submit" className="btn-primary">
            Sign Up
          </button>

          <p className="text-[13px] text-slate-800 mt-3">
            Already a user? Login here{" "}
            <Link className="font-medium text-primary underline" to="/Login">
              Login
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  )
}

export default SignUp