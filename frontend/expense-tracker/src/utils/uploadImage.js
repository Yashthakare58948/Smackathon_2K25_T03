import { API_PATHS } from "./apiPaths";
import axiosInstance from "./axiosInstance";

const uploadImage = async (imageFile) => {
    const formData = new FormData();
    // Append image file to the form data
    formData.append('image', imageFile);

    try {
        const response = await axiosInstance.post(API_PATHS.IMAGE.UPLOAD_IMAGE, formData, {
            headers: {
                'Content-Type': 'multipart/form-data', // Set header for the form data
            },
        });
        return response.data; // Return the response data
    } catch (error) {
        console.error("We had an error uploading the image:", error);
        throw error; // Re-throw the error
    }
};

export default uploadImage;